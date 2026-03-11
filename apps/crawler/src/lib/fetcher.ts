import axios, { type AxiosInstance, type AxiosResponse } from "axios";
import { SocksProxyAgent } from "socks-proxy-agent";

import { createLogger } from "./logger";

const log = createLogger("fetcher");

export interface FetcherOptions {
  torProxyUrl: string;
  requestTimeoutMs: number;
}

export interface FetchResult {
  url: string;
  status: number;
  html: string;
  headers: Record<string, string>;
  fetchedAt: Date;
  responseTimeMs: number;
}

/**
 * Tor-aware HTTP fetcher that routes all requests through a SOCKS5 proxy.
 * Uses axios with socks-proxy-agent for .onion support.
 *
 * The `socks5h://` protocol scheme is important — the `h` means DNS
 * resolution happens on the proxy side (Tor), which is required for
 * resolving .onion addresses.
 */
export class Fetcher {
  private readonly client: AxiosInstance;
  private readonly torProxyUrl: string;

  constructor(options: FetcherOptions) {
    this.torProxyUrl = options.torProxyUrl;

    const agent = new SocksProxyAgent(this.torProxyUrl);

    this.client = axios.create({
      timeout: options.requestTimeoutMs,
      httpAgent: agent,
      httpsAgent: agent,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; rv:128.0) Gecko/20100101 Firefox/128.0",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        Connection: "keep-alive",
      },
      // Don't throw on non-2xx — we handle status codes ourselves
      validateStatus: () => true,
      // Follow redirects up to 5 hops
      maxRedirects: 5,
      // Cap response size at 10MB to avoid memory issues
      maxContentLength: 10 * 1024 * 1024,
      responseType: "text",
    });

    log.info(`Fetcher initialized with Tor proxy at ${this.torProxyUrl}`);
  }

  /**
   * Fetch a single URL through the Tor proxy.
   * Returns the raw HTML and metadata about the response.
   */
  async fetch(url: string): Promise<FetchResult> {
    const startTime = Date.now();

    log.debug(`Fetching: ${url}`);

    let response: AxiosResponse<string>;
    try {
      response = await this.client.get<string>(url);
    } catch (error) {
      const elapsed = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);

      log.error(`Fetch failed (${elapsed}ms): ${url} — ${message}`);
      throw new FetchError(url, message, error);
    }

    const elapsed = Date.now() - startTime;

    if (response.status >= 400) {
      log.warn(`HTTP ${response.status} (${elapsed}ms): ${url}`);
      throw new FetchError(
        url,
        `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    // Extract response headers as a simple record
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(response.headers)) {
      if (typeof value === "string") {
        headers[key] = value;
      } else if (Array.isArray(value)) {
        headers[key] = value.join(", ");
      }
    }

    const html =
      typeof response.data === "string" ? response.data : String(response.data);

    log.info(
      `Fetched (${response.status}, ${elapsed}ms, ${formatBytes(html.length)}): ${url}`,
    );

    return {
      url,
      status: response.status,
      html,
      headers,
      fetchedAt: new Date(),
      responseTimeMs: elapsed,
    };
  }

  /**
   * Verify that the Tor proxy is reachable and working.
   * Attempts to fetch the Tor Project check API.
   */
  async verifyTorConnection(): Promise<boolean> {
    const checkUrl = "https://check.torproject.org/api/ip";

    try {
      log.info("Verifying Tor connection...");
      const response = await this.client.get<string>(checkUrl);

      if (response.status !== 200) {
        log.error(`Tor check returned HTTP ${response.status}`);
        return false;
      }

      // The API returns JSON like { "IsTor": true, "IP": "..." }
      const data =
        typeof response.data === "string"
          ? JSON.parse(response.data)
          : response.data;

      if (data.IsTor) {
        log.info(`Tor connection verified — exit IP: ${data.IP}`);
        return true;
      }

      log.error("Connected but NOT through Tor — check proxy config");
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Tor verification failed: ${message}`);
      return false;
    }
  }
}

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
 * Format byte count into a human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
