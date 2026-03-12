import { env } from "@dark-web-alert-detection/env/crawler";
import { analyzePost } from "./analyzer";
import { Fetcher, TorProxyError } from "./fetcher";
import { createLogger } from "./logger";
import { parsePage } from "./parser";
import { CrawlQueue, type QueueEntry } from "./queue";
import {
  getActiveSources,
  getCrawlerStats,
  isUrlScraped,
  markSourceError,
  storePage,
  updateSourceLastCrawled,
} from "./storage";

const log = createLogger("crawler");

export interface CrawlerOptions {
  /** SOCKS5 Tor proxy URL (e.g. socks5h://127.0.0.1:9050) */
  torProxyUrl: string;
  /** Max number of concurrent page fetches */
  concurrency: number;
  /** Delay between crawl cycles in milliseconds */
  intervalMs: number;
  /** HTTP request timeout in milliseconds */
  requestTimeoutMs: number;
  /** Max retries per URL */
  maxRetries: number;
  /** Max link-follow depth from a seed URL */
  maxDepth: number;
}

export interface CrawlResult {
  url: string;
  sourceId: string;
  success: boolean;
  postId?: string;
  linksDiscovered: number;
  alertsGenerated: number;
  error?: string;
  durationMs: number;
}

/**
 * The main crawler engine. It coordinates the fetcher, parser, storage,
 * and link-discovery queue with bounded concurrency.
 *
 * Lifecycle:
 *   1. Load active sources from the database (seed URLs)
 *   2. Enqueue seed URLs into the crawl queue
 *   3. Process the queue with bounded concurrency:
 *      a. Fetch the page through Tor
 *      b. Parse the HTML (title, content, author, links)
 *      c. Store the post in the database
 *      d. Enqueue discovered links (depth + 1)
 *   4. When the queue is drained, wait for the next interval and repeat
 */
export class Crawler {
  private readonly fetcher: Fetcher;
  private readonly queue: CrawlQueue;
  private readonly options: CrawlerOptions;

  private running = false;
  private activeWorkers = 0;
  private cycleCount = 0;
  private totalCrawled = 0;
  private totalErrors = 0;
  private totalAlerts = 0;

  constructor(options?: Partial<CrawlerOptions>) {
    this.options = {
      torProxyUrl: options?.torProxyUrl ?? env.TOR_PROXY_URL,
      concurrency: options?.concurrency ?? env.CRAWLER_CONCURRENCY,
      intervalMs: options?.intervalMs ?? env.CRAWLER_INTERVAL_MS,
      requestTimeoutMs:
        options?.requestTimeoutMs ?? env.CRAWLER_REQUEST_TIMEOUT_MS,
      maxRetries: options?.maxRetries ?? env.CRAWLER_MAX_RETRIES,
      maxDepth: options?.maxDepth ?? env.CRAWLER_MAX_DEPTH,
    };

    this.fetcher = new Fetcher({
      torProxyUrl: this.options.torProxyUrl,
      requestTimeoutMs: this.options.requestTimeoutMs,
    });

    this.queue = new CrawlQueue({
      maxDepth: this.options.maxDepth,
      maxRetries: this.options.maxRetries,
    });

    log.info("Crawler initialized", {
      concurrency: this.options.concurrency,
      intervalMs: this.options.intervalMs,
      maxDepth: this.options.maxDepth,
      maxRetries: this.options.maxRetries,
    });
  }

  // ─── Public API ────────────────────────────────────────

  /**
   * Start the crawler in continuous mode. It will:
   *  1. Load sources and seed the queue
   *  2. Drain the queue with concurrency control
   *  3. Wait for the configured interval
   *  4. Repeat
   *
   * Call `stop()` to gracefully shut down.
   */
  async start(): Promise<void> {
    if (this.running) {
      log.warn("Crawler is already running");
      return;
    }

    this.running = true;
    log.info("Crawler started — entering main loop");

    // ── Mandatory Tor verification ─────────────────────────
    // The crawler MUST NOT proceed without a verified Tor connection.
    // Without Tor, requests would go directly over clearnet, leaking
    // your real IP to dark web sources.
    log.info("Verifying Tor proxy connection before starting...");

    const torOk = await this.fetcher.verifyTorConnection();
    if (!torOk) {
      log.error("╔══════════════════════════════════════════════════════════╗");
      log.error("║  FATAL: Tor proxy connection FAILED                     ║");
      log.error("║                                                         ║");
      log.error("║  The crawler CANNOT proceed without a working Tor       ║");
      log.error("║  proxy. Without it, all traffic would go directly       ║");
      log.error("║  over clearnet, exposing your real IP address.          ║");
      log.error("║                                                         ║");
      log.error("║  To fix this:                                           ║");
      log.error("║    1. Start the Tor proxy:                              ║");
      log.error("║       docker compose up -d tor-proxy                    ║");
      log.error("║                                                         ║");
      log.error("║    2. Verify it's listening:                            ║");
      log.error(
        "║       curl --socks5 127.0.0.1:9050 https://check.torproject.org/api/ip ║",
      );
      log.error("║                                                         ║");
      log.error("║    3. Check your TOR_PROXY_URL env variable:            ║");
      log.error(`║       Current: ${this.options.torProxyUrl.padEnd(41)}║`);
      log.error("║       Expected: socks5h://127.0.0.1:9050               ║");
      log.error("╚══════════════════════════════════════════════════════════╝");
      this.running = false;
      throw new Error(
        "Tor proxy is not available — refusing to start crawler. " +
          "Start the Tor proxy with: docker compose up -d tor-proxy",
      );
    }

    // ── Main crawl loop ────────────────────────────────────
    while (this.running) {
      try {
        await this.runCycle();
      } catch (error) {
        // If the Tor proxy went down mid-crawl, halt immediately
        if (error instanceof TorProxyError) {
          log.error(
            "Tor proxy lost during crawl cycle — halting crawler to prevent direct connections",
          );
          log.error(
            "Restart the Tor proxy and then restart the crawler to resume.",
          );
          this.running = false;
          throw error;
        }

        const message = error instanceof Error ? error.message : String(error);
        log.error(`Crawl cycle failed: ${message}`);
      }

      if (!this.running) break;

      log.info(
        `Cycle complete — waiting ${this.options.intervalMs}ms before next cycle`,
      );
      await this.sleep(this.options.intervalMs);

      // ── Re-verify Tor between cycles ───────────────────
      // Ensure the proxy hasn't gone down while we were sleeping.
      if (this.running && !this.fetcher.isTorVerified()) {
        log.warn(
          "Tor proxy was marked as unverified — re-checking before next cycle...",
        );
        const reVerified = await this.fetcher.verifyTorConnection();
        if (!reVerified) {
          log.error(
            "Tor proxy re-verification failed — halting crawler to prevent direct connections",
          );
          this.running = false;
          throw new Error(
            "Tor proxy is no longer available — crawler halted for safety. " +
              "Restart the Tor proxy and then restart the crawler.",
          );
        }
        log.info("Tor proxy re-verified — continuing to next cycle");
      }
    }

    log.info("Crawler stopped");
  }

  /**
   * Run a single crawl cycle: load sources, seed the queue, drain it.
   * Useful for one-shot crawling or testing.
   */
  async runCycle(): Promise<void> {
    this.cycleCount++;
    log.info(`═══ Starting crawl cycle #${this.cycleCount} ═══`);

    // Load active sources from the database
    const sources = await getActiveSources();
    if (sources.length === 0) {
      log.warn(
        "No active sources found — add sources to the database to begin crawling",
      );
      return;
    }

    log.info(
      `Loaded ${sources.length} active source(s): ${sources.map(s => s.name).join(", ")}`,
    );

    // Seed the queue with source URLs
    for (const source of sources) {
      this.queue.enqueue(source.url, source.id, 0);
    }

    // Process the queue until drained
    await this.drainQueue();

    // Log stats
    const queueStats = this.queue.stats();
    log.info(
      `Cycle #${this.cycleCount} complete — ` +
        `visited: ${queueStats.visited}, ` +
        `total crawled: ${this.totalCrawled}, ` +
        `total alerts: ${this.totalAlerts}, ` +
        `total errors: ${this.totalErrors}`,
    );

    // Reset visited set for the next cycle so sources can be re-crawled
    this.queue.resetVisited();

    // Log DB stats periodically
    if (this.cycleCount % 5 === 0) {
      try {
        await getCrawlerStats();
      } catch {
        // Non-critical — just skip
      }
    }
  }

  /**
   * Gracefully stop the crawler after the current work completes.
   */
  stop(): void {
    log.info("Stop signal received — crawler will halt after current work");
    this.running = false;
  }

  /**
   * Check whether the crawler is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get a snapshot of crawler runtime statistics.
   */
  getStats() {
    return {
      running: this.running,
      cycleCount: this.cycleCount,
      totalCrawled: this.totalCrawled,
      totalAlerts: this.totalAlerts,
      totalErrors: this.totalErrors,
      activeWorkers: this.activeWorkers,
      queue: this.queue.stats(),
    };
  }

  // ─── Internal: Queue Processing ────────────────────────

  /**
   * Drain the crawl queue by processing entries with bounded concurrency.
   * Spawns up to `concurrency` workers that each pull from the queue.
   */
  private async drainQueue(): Promise<void> {
    return new Promise<void>(resolve => {
      let resolved = false;

      const tryResolve = () => {
        if (resolved) return;
        if (!this.queue.hasWork() && this.activeWorkers === 0) {
          resolved = true;
          resolve();
        }
      };

      const spawnWorker = async () => {
        while (this.running && this.queue.hasPending()) {
          const entry = this.queue.dequeue();
          if (!entry) break;

          this.activeWorkers++;
          try {
            await this.processEntry(entry);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            log.error(`Unhandled error processing ${entry.url}: ${message}`);
          } finally {
            this.activeWorkers--;
          }
        }

        tryResolve();
      };

      // Spawn initial workers up to concurrency limit
      const workersToSpawn = Math.min(
        this.options.concurrency,
        this.queue.stats().pending,
      );

      if (workersToSpawn === 0) {
        resolve();
        return;
      }

      log.info(`Spawning ${workersToSpawn} concurrent worker(s)`);

      const workers: Promise<void>[] = [];
      for (let i = 0; i < workersToSpawn; i++) {
        workers.push(spawnWorker());
      }

      // Safety: also resolve when all workers finish
      Promise.all(workers).then(() => {
        tryResolve();
      });
    });
  }

  /**
   * Process a single queue entry: fetch → parse → store → discover links.
   * Handles errors gracefully and updates queue state accordingly.
   */
  private async processEntry(entry: QueueEntry): Promise<CrawlResult> {
    const startTime = Date.now();
    const { url, sourceId, depth } = entry;

    log.info(`Processing [depth=${depth}, retry=${entry.retries}]: ${url}`);

    // Optionally skip URLs that have already been scraped recently
    // (the DB upsert would handle this too, but this saves a fetch)
    if (depth > 0) {
      const alreadyScraped = await isUrlScraped(url);
      if (alreadyScraped) {
        log.debug(`Skipping (already in DB): ${url}`);
        this.queue.markVisited(url);
        return {
          url,
          sourceId,
          success: true,
          linksDiscovered: 0,
          alertsGenerated: 0,
          durationMs: Date.now() - startTime,
        };
      }
    }

    try {
      // 1. Fetch the page through Tor
      const fetchResult = await this.fetcher.fetch(url);

      // 2. Parse the HTML
      const parsed = parsePage(fetchResult.html, url);

      // Skip storing pages with negligible content
      if (parsed.content.length < 20) {
        log.debug(
          `Skipping storage (content too short: ${parsed.content.length} chars): ${url}`,
        );
        this.queue.markVisited(url);
        return {
          url,
          sourceId,
          success: true,
          linksDiscovered: 0,
          alertsGenerated: 0,
          durationMs: Date.now() - startTime,
        };
      }

      // 3. Store the parsed page in the database
      const storedPost = await storePage({
        sourceId,
        url,
        parsed,
      });

      // 4. Run the leak detection engine on the stored post
      let alertsGenerated = 0;
      try {
        const analysisResult = await analyzePost(storedPost);
        alertsGenerated = analysisResult.alerts.length;
        this.totalAlerts += alertsGenerated;

        if (analysisResult.shouldAlert) {
          log.info(
            `🚨 Leak detected [${analysisResult.riskLevel}] (score: ${analysisResult.compositeScore.toFixed(1)}): ${url} — ` +
              `${alertsGenerated} alert(s)`,
          );
        }
      } catch (analysisError) {
        const analysisMsg =
          analysisError instanceof Error
            ? analysisError.message
            : String(analysisError);
        log.error(`Analysis failed for ${url}: ${analysisMsg}`);
        // Don't fail the entire crawl — the post is already stored
      }

      // 5. Update the source's lastCrawledAt if this is a seed URL (depth 0)
      if (depth === 0) {
        await updateSourceLastCrawled(sourceId);
      }

      // 6. Enqueue discovered links for further crawling
      //    Only follow links that belong to the same domain (stay scoped)
      const scopedLinks = this.filterSameDomain(parsed.links, url);
      const enqueued = this.queue.enqueueMany(scopedLinks, sourceId, depth + 1);

      this.queue.markVisited(url);
      this.totalCrawled++;

      const durationMs = Date.now() - startTime;

      log.info(
        `✓ Crawled (${durationMs}ms): ${url} → ` +
          `postId=${storedPost.id}, links=${enqueued}/${parsed.links.length}, alerts=${alertsGenerated}`,
      );

      return {
        url,
        sourceId,
        success: true,
        postId: storedPost.id,
        linksDiscovered: enqueued,
        alertsGenerated,
        durationMs,
      };
    } catch (error) {
      // If the Tor proxy itself is down, re-throw immediately to halt the crawler.
      // We do NOT want to retry or continue — every further request would either
      // fail or (worse) bypass the proxy.
      if (error instanceof TorProxyError) {
        log.error(
          `🛑 Tor proxy error during fetch of ${url} — propagating to halt crawler`,
        );
        throw error;
      }

      this.totalErrors++;
      const durationMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);

      // Let the queue handle retry logic
      this.queue.markFailed(entry);

      // If this is a seed URL that keeps failing, mark the source as errored
      if (depth === 0 && entry.retries >= this.options.maxRetries - 1) {
        log.error(
          `Seed URL failed after max retries — marking source as ERROR: ${sourceId}`,
        );
        await markSourceError(sourceId);
      }

      log.error(`✗ Failed (${durationMs}ms): ${url} — ${message}`);

      return {
        url,
        sourceId,
        success: false,
        linksDiscovered: 0,
        alertsGenerated: 0,
        error: message,
        durationMs,
      };
    }
  }

  // ─── Internal: Utilities ───────────────────────────────

  /**
   * Filter a list of discovered links to only those belonging to the
   * same domain as the source page. This prevents the crawler from
   * wandering off to unrelated sites.
   *
   * For .onion URLs the full hostname is compared.
   * For clearnet URLs the base domain is compared.
   */
  private filterSameDomain(links: string[], sourceUrl: string): string[] {
    let sourceHost: string;
    try {
      sourceHost = new URL(sourceUrl).hostname.toLowerCase();
    } catch {
      return [];
    }

    return links.filter(link => {
      try {
        const linkHost = new URL(link).hostname.toLowerCase();
        // For .onion addresses, compare the full hostname
        if (sourceHost.endsWith(".onion")) {
          return linkHost === sourceHost;
        }
        // For clearnet, compare base domain (last two parts)
        return getBaseDomain(linkHost) === getBaseDomain(sourceHost);
      } catch {
        return false;
      }
    });
  }

  /**
   * Sleep for the given number of milliseconds.
   * Returns early if the crawler is stopped.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      const timer = setTimeout(resolve, ms);

      // Check periodically if we should stop early
      const checkInterval = setInterval(() => {
        if (!this.running) {
          clearTimeout(timer);
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);

      // Clean up the check interval when the timer fires naturally
      setTimeout(() => {
        clearInterval(checkInterval);
      }, ms + 100);
    });
  }
}

/**
 * Extract the base domain from a hostname.
 * e.g. "forum.example.com" → "example.com"
 */
function getBaseDomain(hostname: string): string {
  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join(".");
}
