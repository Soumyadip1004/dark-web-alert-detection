import { createLogger } from "./logger";

const log = createLogger("queue");

export interface QueueEntry {
  url: string;
  sourceId: string;
  depth: number;
  retries: number;
  addedAt: Date;
}

export interface QueueOptions {
  maxDepth: number;
  maxRetries: number;
}

/**
 * In-memory URL queue with visited tracking, depth control,
 * and domain-based deduplication. Can be upgraded to Redis later.
 */
export class CrawlQueue {
  private queue: QueueEntry[] = [];
  private visited: Set<string> = new Set();
  private inProgress: Set<string> = new Set();
  private readonly maxDepth: number;
  private readonly maxRetries: number;

  constructor(options: QueueOptions) {
    this.maxDepth = options.maxDepth;
    this.maxRetries = options.maxRetries;
  }

  /**
   * Normalize a URL to prevent duplicate crawling of equivalent URLs.
   * Strips trailing slashes, fragments, and lowercases the hostname.
   */
  private normalizeUrl(raw: string): string {
    try {
      const parsed = new URL(raw);
      // Remove fragment
      parsed.hash = "";
      // Sort search params for consistent dedup
      parsed.searchParams.sort();
      // Remove trailing slash from pathname (except root)
      if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
        parsed.pathname = parsed.pathname.slice(0, -1);
      }
      return parsed.toString();
    } catch {
      // If URL parsing fails, return as-is (will likely fail at fetch time)
      return raw.trim().toLowerCase();
    }
  }

  /**
   * Add a URL to the queue if it hasn't been visited or queued already,
   * and if it doesn't exceed the max crawl depth.
   */
  enqueue(url: string, sourceId: string, depth = 0): boolean {
    const normalized = this.normalizeUrl(url);

    if (depth > this.maxDepth) {
      log.debug(`Skipping (max depth ${this.maxDepth}): ${normalized}`);
      return false;
    }

    if (this.visited.has(normalized)) {
      log.debug(`Skipping (already visited): ${normalized}`);
      return false;
    }

    if (this.inProgress.has(normalized)) {
      log.debug(`Skipping (in progress): ${normalized}`);
      return false;
    }

    // Check if already in queue
    const alreadyQueued = this.queue.some(
      entry => this.normalizeUrl(entry.url) === normalized,
    );
    if (alreadyQueued) {
      log.debug(`Skipping (already queued): ${normalized}`);
      return false;
    }

    this.queue.push({
      url: normalized,
      sourceId,
      depth,
      retries: 0,
      addedAt: new Date(),
    });

    log.debug(`Enqueued (depth=${depth}): ${normalized}`);
    return true;
  }

  /**
   * Add multiple URLs at once, typically discovered links from a crawled page.
   * Returns the count of URLs actually enqueued.
   */
  enqueueMany(urls: string[], sourceId: string, depth: number): number {
    let count = 0;
    for (const url of urls) {
      if (this.enqueue(url, sourceId, depth)) {
        count++;
      }
    }
    if (count > 0) {
      log.info(
        `Enqueued ${count}/${urls.length} discovered links at depth ${depth}`,
      );
    }
    return count;
  }

  /**
   * Take the next URL from the queue for processing.
   * Marks it as in-progress to prevent concurrent duplicate crawls.
   */
  dequeue(): QueueEntry | undefined {
    const entry = this.queue.shift();
    if (entry) {
      this.inProgress.add(this.normalizeUrl(entry.url));
    }
    return entry;
  }

  /**
   * Mark a URL as successfully crawled.
   * Moves it from in-progress to visited.
   */
  markVisited(url: string): void {
    const normalized = this.normalizeUrl(url);
    this.inProgress.delete(normalized);
    this.visited.add(normalized);
  }

  /**
   * Handle a failed crawl attempt. Re-enqueues if retries remain,
   * otherwise marks it as visited to stop retrying.
   */
  markFailed(entry: QueueEntry): void {
    const normalized = this.normalizeUrl(entry.url);
    this.inProgress.delete(normalized);

    if (entry.retries < this.maxRetries) {
      const retryEntry: QueueEntry = {
        ...entry,
        url: normalized,
        retries: entry.retries + 1,
        addedAt: new Date(),
      };
      this.queue.push(retryEntry);
      log.warn(
        `Re-queued (retry ${retryEntry.retries}/${this.maxRetries}): ${normalized}`,
      );
    } else {
      this.visited.add(normalized);
      log.error(`Giving up after ${this.maxRetries} retries: ${normalized}`);
    }
  }

  /**
   * Check if there are any URLs left to process (queued or in-progress).
   */
  hasWork(): boolean {
    return this.queue.length > 0 || this.inProgress.size > 0;
  }

  /**
   * Check if there are URLs ready to be dequeued.
   */
  hasPending(): boolean {
    return this.queue.length > 0;
  }

  /**
   * Get current queue statistics.
   */
  stats(): {
    pending: number;
    inProgress: number;
    visited: number;
    total: number;
  } {
    return {
      pending: this.queue.length,
      inProgress: this.inProgress.size,
      visited: this.visited.size,
      total: this.queue.length + this.inProgress.size + this.visited.size,
    };
  }

  /**
   * Clear all state — useful for testing or restarting a crawl cycle.
   */
  clear(): void {
    this.queue = [];
    this.visited.clear();
    this.inProgress.clear();
    log.info("Queue cleared");
  }

  /**
   * Clear only the visited set, keeping the current queue intact.
   * Useful for periodic re-crawls of known sources.
   */
  resetVisited(): void {
    this.visited.clear();
    log.info("Visited set cleared — URLs can be re-crawled");
  }
}
