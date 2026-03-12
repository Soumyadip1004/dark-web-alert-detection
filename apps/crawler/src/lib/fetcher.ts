import * as net from "node:net";
import * as tls from "node:tls";
import * as zlib from "node:zlib";
import { SocksClient } from "socks";

import { createLogger } from "./logger";

const log = createLogger("fetcher");

export interface FetcherOptions {
  torProxyUrl: string;
  requestTimeoutMs: number;
  /** How often (in ms) to re-verify the Tor proxy is alive. Default: 60000 (1 min) */
  proxyHealthCheckIntervalMs?: number;
  /** Max consecutive proxy health check failures before refusing to fetch. Default: 3 */
  maxConsecutiveProxyFailures?: number;
}

export interface FetchResult {
  url: string;
  status: number;
  html: string;
  headers: Record<string, string>;
  fetchedAt: Date;
  responseTimeMs: number;
}

interface ParsedUrl {
  protocol: "http:" | "https:";
  hostname: string;
  port: number;
  path: string;
}

/**
 * Tor-aware HTTP fetcher that routes ALL requests through a SOCKS5 proxy.
 *
 * IMPORTANT — WHY NOT AXIOS?
 * ──────────────────────────
 * Bun's runtime (v1.x) does NOT honor the `agent` option on HTTPS requests.
 * This means `axios`, `node:https`, and any library that relies on
 * `httpsAgent` will silently bypass the SOCKS proxy and connect directly,
 * leaking your real IP address. This was confirmed empirically:
 *
 *   ❌ axios + SocksProxyAgent   → IsTor: false (DIRECT)
 *   ❌ https.get + agent         → IsTor: false (DIRECT)
 *   ✅ Raw SocksClient + TLS    → IsTor: true  (TOR)
 *
 * Therefore this fetcher uses `socks` (SocksClient) to establish the
 * SOCKS5 tunnel, then manually wraps it in TLS for HTTPS, and speaks
 * raw HTTP/1.1 over the resulting socket. This is the ONLY reliable way
 * to guarantee traffic goes through Tor when running under Bun.
 *
 * The `socks5h://` protocol scheme means DNS resolution happens on the
 * proxy side (Tor), which is required for resolving .onion addresses.
 *
 * SECURITY GUARANTEES:
 *  - Will NOT make any request unless the Tor proxy has been verified.
 *  - Will NOT fall back to a direct connection if the proxy is down.
 *  - Periodically re-checks proxy health and halts fetching if proxy dies.
 *  - Validates that the proxy URL uses the socks5h:// scheme.
 *  - Every single request goes through the raw SOCKS tunnel — no exceptions.
 */
export class Fetcher {
  private readonly torProxyUrl: string;
  private readonly proxyHost: string;
  private readonly proxyPort: number;
  private readonly requestTimeoutMs: number;
  private readonly proxyHealthCheckIntervalMs: number;
  private readonly maxConsecutiveProxyFailures: number;

  private readonly defaultHeaders: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; rv:128.0) Gecko/20100101 Firefox/128.0",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate",
    Connection: "close",
  };

  private torVerified = false;
  private torExitIp: string | null = null;
  private lastProxyHealthCheck = 0;
  private consecutiveProxyFailures = 0;

  /** Max response body size: 10 MB */
  private readonly maxResponseBytes = 10 * 1024 * 1024;
  /** Max number of HTTP redirects to follow */
  private readonly maxRedirects = 5;

  constructor(options: FetcherOptions) {
    this.torProxyUrl = options.torProxyUrl;
    this.requestTimeoutMs = options.requestTimeoutMs;
    this.proxyHealthCheckIntervalMs =
      options.proxyHealthCheckIntervalMs ?? 60_000;
    this.maxConsecutiveProxyFailures = options.maxConsecutiveProxyFailures ?? 3;

    // ── Validate the proxy URL scheme ──────────────────────
    // We MUST use socks5h:// so DNS resolution happens on the Tor side.
    // Using socks5:// would leak DNS queries to the local resolver.
    if (!this.torProxyUrl.startsWith("socks5h://")) {
      throw new FetcherConfigError(
        `Tor proxy URL must use the socks5h:// scheme (got "${this.torProxyUrl}"). ` +
          'The "h" ensures DNS resolution happens inside Tor, which is required ' +
          "for .onion resolution and to prevent DNS leaks.",
      );
    }

    // ── Parse host and port for TCP-level health checks ────
    try {
      const parsed = new URL(this.torProxyUrl);
      this.proxyHost = parsed.hostname;
      this.proxyPort = Number.parseInt(parsed.port, 10) || 9050;
    } catch {
      throw new FetcherConfigError(
        `Failed to parse Tor proxy URL: "${this.torProxyUrl}"`,
      );
    }

    log.info(`Fetcher initialized with Tor proxy at ${this.torProxyUrl}`);
    log.info(
      `  Proxy health check interval: ${this.proxyHealthCheckIntervalMs}ms`,
    );
    log.info(
      `  Max consecutive proxy failures before halt: ${this.maxConsecutiveProxyFailures}`,
    );
    log.info("  Transport: Raw SocksClient + TLS (Bun-safe, no axios)");
  }

  // ─── Public API ────────────────────────────────────────

  /**
   * Fetch a single URL through the Tor SOCKS5 proxy.
   * Returns the raw HTML and metadata about the response.
   *
   * WILL REFUSE to fetch if:
   *  - Tor proxy has never been verified (call verifyTorConnection first)
   *  - The Tor proxy has failed consecutive health checks
   *  - The TCP connection to the SOCKS proxy port is dead
   */
  async fetch(url: string): Promise<FetchResult> {
    // ── Gate 1: Tor must have been verified at least once ──
    if (!this.torVerified) {
      throw new TorProxyError(
        `Cannot fetch "${url}" — Tor proxy has not been verified. ` +
          "Call verifyTorConnection() and ensure it returns true before crawling.",
      );
    }

    // ── Gate 2: Periodic proxy liveness check ──────────────
    await this.ensureProxyAlive(url);

    const startTime = Date.now();
    log.debug(`Fetching: ${url}`);

    try {
      const result = await this.fetchWithRedirects(url, this.maxRedirects);

      const elapsed = Date.now() - startTime;

      // Successful fetch — reset proxy failure counter
      this.consecutiveProxyFailures = 0;

      if (result.status >= 400) {
        log.warn(`HTTP ${result.status} (${elapsed}ms): ${url}`);
        throw new FetchError(
          url,
          `HTTP ${result.status}: ${result.statusText}`,
        );
      }

      log.info(
        `Fetched (${result.status}, ${elapsed}ms, ${formatBytes(result.html.length)}): ${url}`,
      );

      return {
        url,
        status: result.status,
        html: result.html,
        headers: result.headers,
        fetchedAt: new Date(),
        responseTimeMs: elapsed,
      };
    } catch (error) {
      const elapsed = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);

      // Re-throw our own error types as-is
      if (error instanceof TorProxyError || error instanceof FetchError) {
        throw error;
      }

      // Detect proxy-level failures and categorize them distinctly
      if (this.isProxyConnectionError(error)) {
        this.consecutiveProxyFailures++;
        log.error(
          `Tor proxy connection failed (consecutive failures: ${this.consecutiveProxyFailures}): ${message}`,
        );

        throw new TorProxyError(
          `Tor proxy unreachable while fetching "${url}": ${message}. ` +
            `Ensure the Tor SOCKS5 proxy is running at ${this.torProxyUrl}`,
        );
      }

      log.error(`Fetch failed (${elapsed}ms): ${url} — ${message}`);
      throw new FetchError(url, message, error);
    }
  }

  /**
   * Verify that the Tor proxy is reachable and working.
   * Performs TWO checks:
   *   1. TCP connectivity to the SOCKS5 proxy port (fast, <2s)
   *   2. An actual request through Tor to confirm traffic is routed correctly
   *
   * This MUST be called (and return true) before any fetch() calls.
   * The crawler should NOT proceed if this returns false.
   */
  async verifyTorConnection(): Promise<boolean> {
    log.info("═══ Verifying Tor proxy connection ═══");

    // ── Step 1: TCP port check ─────────────────────────────
    log.info(
      `Step 1/2: Checking TCP connectivity to ${this.proxyHost}:${this.proxyPort}...`,
    );

    const tcpAlive = await this.checkProxyTcp();
    if (!tcpAlive) {
      log.error(
        `✗ TCP connection to Tor SOCKS5 proxy FAILED at ${this.proxyHost}:${this.proxyPort}. ` +
          "Is the Tor proxy running? Start it with: docker compose up -d tor-proxy",
      );
      this.torVerified = false;
      return false;
    }

    log.info(
      `✓ TCP connection to ${this.proxyHost}:${this.proxyPort} succeeded`,
    );

    // ── Step 2: Actual Tor routing verification ────────────
    const checkUrl = "https://check.torproject.org/api/ip";

    try {
      log.info(
        `Step 2/2: Verifying traffic routes through Tor via ${checkUrl}...`,
      );

      const result = await this.rawFetchUrl(checkUrl);

      if (result.status !== 200) {
        log.error(
          `✗ Tor check returned HTTP ${result.status} — proxy may be misconfigured`,
        );
        this.torVerified = false;
        return false;
      }

      // The API returns JSON like { "IsTor": true, "IP": "..." }
      const data = JSON.parse(result.html);

      if (data.IsTor) {
        this.torVerified = true;
        this.torExitIp = data.IP ?? null;
        this.consecutiveProxyFailures = 0;
        this.lastProxyHealthCheck = Date.now();

        log.info(`✓ Tor connection VERIFIED — exit IP: ${data.IP}`);
        log.info("═══ Tor proxy is ready — crawling is safe to proceed ═══");
        return true;
      }

      log.error(
        `✗ Connected but traffic is NOT routing through Tor (IsTor=false, IP=${data.IP}). ` +
          `Check your proxy configuration. The SOCKS5 proxy at ${this.torProxyUrl} ` +
          "is not a Tor proxy or is misconfigured.",
      );
      this.torVerified = false;
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (this.isProxyConnectionError(error)) {
        log.error(
          `✗ Tor verification failed — SOCKS5 proxy connection error: ${message}. ` +
            "The proxy port is open but not accepting SOCKS5 connections properly.",
        );
      } else {
        log.error(`✗ Tor verification failed: ${message}`);
      }

      this.torVerified = false;
      return false;
    }
  }

  /**
   * Check if the Tor proxy has been verified and is considered healthy.
   */
  isTorVerified(): boolean {
    return this.torVerified;
  }

  /**
   * Get the Tor exit IP discovered during verification.
   */
  getTorExitIp(): string | null {
    return this.torExitIp;
  }

  // ─── Internal: HTTP over SOCKS ─────────────────────────

  /**
   * Fetch a URL through the SOCKS5 proxy, following redirects.
   */
  private async fetchWithRedirects(
    url: string,
    remainingRedirects: number,
  ): Promise<{
    status: number;
    statusText: string;
    html: string;
    headers: Record<string, string>;
  }> {
    const result = await this.rawFetchUrl(url);

    // Handle redirects (301, 302, 303, 307, 308)
    if (
      remainingRedirects > 0 &&
      result.status >= 300 &&
      result.status < 400 &&
      result.headers.location
    ) {
      const redirectUrl = this.resolveRedirect(result.headers.location, url);
      log.debug(
        `Following redirect (${result.status}): ${url} → ${redirectUrl}`,
      );
      return this.fetchWithRedirects(redirectUrl, remainingRedirects - 1);
    }

    return result;
  }

  /**
   * Core fetch method: establish a SOCKS5 tunnel to the target,
   * optionally wrap in TLS, send an HTTP/1.1 request, and collect the response.
   *
   * This is the ONLY method that makes network connections, and it
   * ALWAYS goes through the SOCKS proxy — there is no fallback path.
   */
  private async rawFetchUrl(url: string): Promise<{
    status: number;
    statusText: string;
    html: string;
    headers: Record<string, string>;
  }> {
    const parsed = this.parseUrl(url);

    // 1. Establish SOCKS5 tunnel
    const socksConnection = await SocksClient.createConnection({
      proxy: {
        host: this.proxyHost,
        port: this.proxyPort,
        type: 5,
      },
      command: "connect",
      destination: {
        host: parsed.hostname,
        port: parsed.port,
      },
      timeout: this.requestTimeoutMs,
    });

    log.debug(`SOCKS tunnel established to ${parsed.hostname}:${parsed.port}`);

    // 2. Get the connected socket (optionally wrapped in TLS)
    let socket: net.Socket | tls.TLSSocket = socksConnection.socket;

    if (parsed.protocol === "https:") {
      socket = await this.upgradeTls(socksConnection.socket, parsed.hostname);
      log.debug(`TLS handshake complete for ${parsed.hostname}`);
    }

    // 3. Send HTTP request and receive response over the tunnel
    try {
      return await this.httpExchange(socket, parsed);
    } finally {
      socket.destroy();
    }
  }

  /**
   * Wrap an existing socket in a TLS connection.
   */
  private upgradeTls(
    socket: net.Socket,
    hostname: string,
  ): Promise<tls.TLSSocket> {
    return new Promise<tls.TLSSocket>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`TLS handshake timed out for ${hostname}`));
      }, this.requestTimeoutMs);

      const tlsSocket = tls.connect(
        {
          host: hostname,
          socket,
          servername: hostname,
          // .onion sites often have self-signed certs
          rejectUnauthorized: !hostname.endsWith(".onion"),
        },
        () => {
          clearTimeout(timeout);
          resolve(tlsSocket);
        },
      );

      tlsSocket.once("error", (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * Perform a raw HTTP/1.1 request/response exchange over a connected socket.
   * Handles chunked transfer encoding, content-length, and gzip/deflate.
   */
  private httpExchange(
    socket: net.Socket | tls.TLSSocket,
    parsed: ParsedUrl,
  ): Promise<{
    status: number;
    statusText: string;
    html: string;
    headers: Record<string, string>;
  }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(
          new Error(
            `HTTP request timed out for ${parsed.hostname}${parsed.path}`,
          ),
        );
      }, this.requestTimeoutMs);

      // Build the Host header (include port only if non-standard)
      const isDefaultPort =
        (parsed.protocol === "http:" && parsed.port === 80) ||
        (parsed.protocol === "https:" && parsed.port === 443);
      const hostHeader = isDefaultPort
        ? parsed.hostname
        : `${parsed.hostname}:${parsed.port}`;

      // Build the request
      const headerLines: string[] = [
        `GET ${parsed.path} HTTP/1.1`,
        `Host: ${hostHeader}`,
      ];
      for (const [key, value] of Object.entries(this.defaultHeaders)) {
        headerLines.push(`${key}: ${value}`);
      }
      headerLines.push("", ""); // Blank line terminates headers

      const requestStr = headerLines.join("\r\n");

      // State machine for parsing the response
      let rawData = Buffer.alloc(0);
      let headersParsed = false;
      let status = 0;
      let statusText = "";
      let responseHeaders: Record<string, string> = {};
      let headerEndIndex = -1;

      const onData = (chunk: Buffer) => {
        rawData = Buffer.concat([rawData, chunk]);

        // Check max size
        if (rawData.length > this.maxResponseBytes) {
          clearTimeout(timeout);
          socket.destroy();
          reject(
            new Error(
              `Response exceeded maximum size of ${formatBytes(this.maxResponseBytes)}`,
            ),
          );
          return;
        }

        // Try to parse headers if we haven't yet
        if (!headersParsed) {
          headerEndIndex = rawData.indexOf("\r\n\r\n");
          if (headerEndIndex === -1) return; // Need more data

          headersParsed = true;
          const headerBlock = rawData
            .subarray(0, headerEndIndex)
            .toString("utf-8");
          const parsedHeaders = this.parseHttpResponse(headerBlock);
          status = parsedHeaders.status;
          statusText = parsedHeaders.statusText;
          responseHeaders = parsedHeaders.headers;
        }
      };

      const onEnd = () => {
        clearTimeout(timeout);
        socket.removeListener("data", onData);
        socket.removeListener("end", onEnd);
        socket.removeListener("error", onError);

        if (!headersParsed) {
          reject(new Error("Connection closed before receiving HTTP headers"));
          return;
        }

        // Extract the body (everything after the header separator)
        const bodyBuffer = rawData.subarray(headerEndIndex + 4);

        // Decode the body (handle chunked encoding)
        const decodedBody = this.decodeBody(bodyBuffer, responseHeaders);

        // Decompress if needed
        this.decompressBody(decodedBody, responseHeaders)
          .then(html => {
            resolve({ status, statusText, html, headers: responseHeaders });
          })
          .catch(reject);
      };

      const onError = (err: Error) => {
        clearTimeout(timeout);
        socket.removeListener("data", onData);
        socket.removeListener("end", onEnd);
        socket.removeListener("error", onError);
        reject(err);
      };

      socket.on("data", onData);
      socket.on("end", onEnd);
      socket.on("error", onError);

      // Send the request
      socket.write(requestStr);
    });
  }

  /**
   * Parse the HTTP response status line and headers from raw text.
   */
  private parseHttpResponse(headerBlock: string): {
    status: number;
    statusText: string;
    headers: Record<string, string>;
  } {
    const lines = headerBlock.split("\r\n");
    const statusLine = lines[0] ?? "";

    // Parse "HTTP/1.1 200 OK"
    const statusMatch = statusLine.match(/^HTTP\/\d+\.?\d*\s+(\d+)\s*(.*)/);
    const status = statusMatch ? Number.parseInt(statusMatch[1] ?? "0", 10) : 0;
    const statusText = statusMatch?.[2]?.trim() ?? "";

    const headers: Record<string, string> = {};
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const colonIndex = line.indexOf(":");
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim().toLowerCase();
        const value = line.substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    }

    return { status, statusText, headers };
  }

  /**
   * Decode the response body, handling chunked transfer encoding.
   */
  private decodeBody(body: Buffer, headers: Record<string, string>): Buffer {
    if (headers["transfer-encoding"]?.toLowerCase().includes("chunked")) {
      return this.decodeChunked(body);
    }
    return body;
  }

  /**
   * Decode an HTTP chunked transfer-encoded body.
   */
  private decodeChunked(data: Buffer): Buffer {
    const chunks: Buffer[] = [];
    let offset = 0;

    while (offset < data.length) {
      // Find the end of the chunk size line
      const lineEnd = data.indexOf("\r\n", offset);
      if (lineEnd === -1) break;

      const sizeStr = data.subarray(offset, lineEnd).toString("utf-8").trim();
      // Chunk size may have extensions after a semicolon
      const size = Number.parseInt(sizeStr.split(";")[0] ?? "0", 16);
      if (Number.isNaN(size) || size === 0) break;

      const chunkStart = lineEnd + 2;
      const chunkEnd = chunkStart + size;

      if (chunkEnd > data.length) {
        // Incomplete chunk — take what we have
        chunks.push(data.subarray(chunkStart));
        break;
      }

      chunks.push(data.subarray(chunkStart, chunkEnd));
      // Skip past the chunk data and the trailing \r\n
      offset = chunkEnd + 2;
    }

    return Buffer.concat(chunks);
  }

  /**
   * Decompress the response body if Content-Encoding is gzip or deflate.
   */
  private async decompressBody(
    body: Buffer,
    headers: Record<string, string>,
  ): Promise<string> {
    const encoding = headers["content-encoding"]?.toLowerCase();

    if (encoding === "gzip" || encoding === "x-gzip") {
      return new Promise<string>((resolve, _reject) => {
        zlib.gunzip(body, (err, result) => {
          if (err) {
            // If decompression fails, try returning as plain text
            log.debug(
              `gzip decompression failed, returning raw body: ${err.message}`,
            );
            resolve(body.toString("utf-8"));
          } else {
            resolve(result.toString("utf-8"));
          }
        });
      });
    }

    if (encoding === "deflate") {
      return new Promise<string>((resolve, _reject) => {
        zlib.inflate(body, (err, result) => {
          if (err) {
            log.debug(
              `deflate decompression failed, returning raw body: ${err.message}`,
            );
            resolve(body.toString("utf-8"));
          } else {
            resolve(result.toString("utf-8"));
          }
        });
      });
    }

    return body.toString("utf-8");
  }

  /**
   * Resolve a redirect Location header to an absolute URL.
   */
  private resolveRedirect(location: string, baseUrl: string): string {
    try {
      return new URL(location, baseUrl).toString();
    } catch {
      return location;
    }
  }

  /**
   * Parse a URL string into its components.
   */
  private parseUrl(url: string): ParsedUrl {
    const parsed = new URL(url);
    const protocol = parsed.protocol as "http:" | "https:";
    const hostname = parsed.hostname;
    const defaultPort = protocol === "https:" ? 443 : 80;
    const port = parsed.port ? Number.parseInt(parsed.port, 10) : defaultPort;
    const path = parsed.pathname + parsed.search + parsed.hash;

    return { protocol, hostname, port, path: path || "/" };
  }

  // ─── Internal: Proxy Health Checks ─────────────────────

  /**
   * Ensure the SOCKS proxy is still alive before making a fetch.
   * Uses a lightweight TCP check at a configurable interval.
   * Throws TorProxyError if the proxy appears to be down.
   */
  private async ensureProxyAlive(fetchUrl: string): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastProxyHealthCheck;

    // Skip if we checked recently
    if (elapsed < this.proxyHealthCheckIntervalMs) {
      return;
    }

    log.debug("Running periodic Tor proxy health check...");

    const alive = await this.checkProxyTcp();
    this.lastProxyHealthCheck = Date.now();

    if (alive) {
      // Reset failure counter on success
      if (this.consecutiveProxyFailures > 0) {
        log.info(
          `Tor proxy health check passed — resetting failure counter (was ${this.consecutiveProxyFailures})`,
        );
      }
      this.consecutiveProxyFailures = 0;
      return;
    }

    this.consecutiveProxyFailures++;
    log.error(
      `Tor proxy health check FAILED (consecutive failures: ${this.consecutiveProxyFailures}/${this.maxConsecutiveProxyFailures})`,
    );

    if (this.consecutiveProxyFailures >= this.maxConsecutiveProxyFailures) {
      // Mark Tor as unverified to block all future fetches until re-verified
      this.torVerified = false;

      throw new TorProxyError(
        `Tor proxy has failed ${this.consecutiveProxyFailures} consecutive health checks. ` +
          `Refusing to fetch "${fetchUrl}" to prevent direct (non-Tor) connections. ` +
          `Ensure the Tor proxy is running at ${this.torProxyUrl} and restart the crawler.`,
      );
    }

    // Under the threshold — warn but allow the fetch to attempt
    // (the SocksClient will still fail if the proxy is truly down,
    //  and that error will be caught and counted in fetch())
    log.warn(
      "Tor proxy may be unstable — allowing fetch attempt but monitoring closely",
    );
  }

  /**
   * Low-level TCP connectivity check to the SOCKS5 proxy port.
   * This is a fast check (~1-2s) that doesn't depend on Tor circuits
   * being built — it only verifies the proxy process is listening.
   */
  private checkProxyTcp(): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      const socket = new net.Socket();
      const timeout = 5_000; // 5 second timeout for TCP connect

      socket.setTimeout(timeout);

      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });

      socket.once("timeout", () => {
        socket.destroy();
        log.debug(
          `TCP check to ${this.proxyHost}:${this.proxyPort} timed out after ${timeout}ms`,
        );
        resolve(false);
      });

      socket.once("error", err => {
        socket.destroy();
        log.debug(
          `TCP check to ${this.proxyHost}:${this.proxyPort} failed: ${err.message}`,
        );
        resolve(false);
      });

      socket.connect(this.proxyPort, this.proxyHost);
    });
  }

  /**
   * Determine if an error is a proxy/SOCKS connection failure
   * (as opposed to a remote server error or timeout).
   */
  private isProxyConnectionError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const message = error.message.toLowerCase();
    const proxyIndicators = [
      "socks",
      "proxy",
      "econnrefused",
      "socket hang up",
      "connect econnrefused",
      "socksconnection",
      "socks5",
      "socks4",
      "proxy connection",
      "tunnel",
      "connection to proxy",
      "failed to establish",
      "not established",
    ];

    for (const indicator of proxyIndicators) {
      if (message.includes(indicator)) {
        return true;
      }
    }

    // Also check nested cause
    if ("cause" in error && error.cause instanceof Error) {
      return this.isProxyConnectionError(error.cause);
    }

    // Check the error code (Node.js network errors)
    if ("code" in error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (
        code === "ECONNREFUSED" ||
        code === "ETIMEDOUT" ||
        code === "ENETUNREACH"
      ) {
        // Could be proxy or target — check if the address matches the proxy
        if ("address" in error) {
          const addr = (error as NodeJS.ErrnoException & { address?: string })
            .address;
          if (
            addr === this.proxyHost ||
            addr === "127.0.0.1" ||
            addr === "::1"
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }
}

// ─── Error Classes ─────────────────────────────────────

/**
 * Custom error class for fetch failures, preserving the URL context.
 */
export class FetchError extends Error {
  public readonly url: string;
  public readonly cause: unknown;

  constructor(url: string, message: string, cause?: unknown) {
    super(`FetchError [${url}]: ${message}`);
    this.name = "FetchError";
    this.url = url;
    this.cause = cause;
  }
}

/**
 * Error thrown when the Tor proxy is unreachable, misconfigured,
 * or has failed health checks. This error indicates the crawler
 * MUST NOT continue fetching to avoid direct connections.
 */
export class TorProxyError extends Error {
  constructor(message: string) {
    super(`TorProxyError: ${message}`);
    this.name = "TorProxyError";
  }
}

/**
 * Error thrown when the Fetcher is misconfigured (e.g. bad proxy URL).
 * This is a fatal initialization error.
 */
export class FetcherConfigError extends Error {
  constructor(message: string) {
    super(`FetcherConfigError: ${message}`);
    this.name = "FetcherConfigError";
  }
}

// ─── Utilities ─────────────────────────────────────────

/**
 * Format byte count into a human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
