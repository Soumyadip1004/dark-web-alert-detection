import prisma from "@dark-web-alert-detection/db/crawler";

import { createLogger } from "./logger";
import type { ParsedPage } from "./parser";

const log = createLogger("storage");

export interface StoredPost {
  id: string;
  sourceId: string;
  url: string;
  title: string | null;
  content: string;
  author: string | null;
  scrapedAt: Date;
}

export interface StorePageInput {
  sourceId: string;
  url: string;
  parsed: ParsedPage;
}

/**
 * Storage layer responsible for persisting crawled data and managing
 * source status in the database via Prisma.
 *
 * All database writes go through this module so the crawler logic
 * stays decoupled from the persistence layer.
 */

// ─── Post Storage ──────────────────────────────────────

/**
 * Save a crawled and parsed page to the database.
 * Uses upsert to handle re-crawls of the same URL gracefully —
 * if the URL already exists, we update the content instead of failing.
 */
export async function storePage(input: StorePageInput): Promise<StoredPost> {
  const { sourceId, url, parsed } = input;

  try {
    const post = await prisma.post.upsert({
      where: { url },
      create: {
        sourceId,
        url,
        title: parsed.title,
        content: parsed.content,
        author: parsed.author,
        scrapedAt: new Date(),
      },
      update: {
        title: parsed.title,
        content: parsed.content,
        author: parsed.author,
        scrapedAt: new Date(),
      },
    });

    log.info(`Stored post: ${url} (id=${post.id})`);

    return {
      id: post.id,
      sourceId: post.sourceId,
      url: post.url,
      title: post.title,
      content: post.content,
      author: post.author,
      scrapedAt: post.scrapedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to store page ${url}: ${message}`);
    throw new StorageError(`Failed to store page: ${message}`, error);
  }
}

/**
 * Mark a post as analyzed by setting its analyzedAt timestamp.
 * Called after the leak detection engine has processed the post.
 */
export async function markPostAnalyzed(postId: string): Promise<void> {
  try {
    await prisma.post.update({
      where: { id: postId },
      data: { analyzedAt: new Date() },
    });
    log.debug(`Marked post as analyzed: ${postId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to mark post analyzed (${postId}): ${message}`);
    throw new StorageError(`Failed to mark post analyzed: ${message}`, error);
  }
}

/**
 * Check if a URL has already been scraped and stored.
 * Used by the crawler to avoid redundant fetches.
 */
export async function isUrlScraped(url: string): Promise<boolean> {
  try {
    const count = await prisma.post.count({
      where: { url },
    });
    return count > 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to check URL existence (${url}): ${message}`);
    return false;
  }
}

/**
 * Fetch posts that haven't been analyzed yet.
 * Used by the detection engine to find work.
 */
export async function getUnanalyzedPosts(limit = 100): Promise<StoredPost[]> {
  try {
    const posts = await prisma.post.findMany({
      where: { analyzedAt: null },
      orderBy: { scrapedAt: "asc" },
      take: limit,
    });

    log.debug(`Found ${posts.length} unanalyzed posts`);
    return posts;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to fetch unanalyzed posts: ${message}`);
    throw new StorageError(
      `Failed to fetch unanalyzed posts: ${message}`,
      error,
    );
  }
}

// ─── Source Management ─────────────────────────────────

/**
 * Fetch all active sources from the database.
 * These are the seed URLs the crawler will begin crawling from.
 */
export async function getActiveSources() {
  try {
    const sources = await prisma.source.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ priority: "desc" }, { lastCrawledAt: "asc" }],
    });

    log.info(`Loaded ${sources.length} active sources`);
    return sources;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to load active sources: ${message}`);
    throw new StorageError(`Failed to load active sources: ${message}`, error);
  }
}

/**
 * Update the lastCrawledAt timestamp for a source.
 * Called after a successful crawl of the source's seed URL.
 */
export async function updateSourceLastCrawled(sourceId: string): Promise<void> {
  try {
    await prisma.source.update({
      where: { id: sourceId },
      data: { lastCrawledAt: new Date() },
    });
    log.debug(`Updated lastCrawledAt for source: ${sourceId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(
      `Failed to update lastCrawledAt for source (${sourceId}): ${message}`,
    );
  }
}

/**
 * Mark a source as having an error status.
 * Called when a source repeatedly fails to be crawled.
 */
export async function markSourceError(sourceId: string): Promise<void> {
  try {
    await prisma.source.update({
      where: { id: sourceId },
      data: { status: "ERROR" },
    });
    log.warn(`Marked source as ERROR: ${sourceId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to mark source as error (${sourceId}): ${message}`);
  }
}

/**
 * Mark a source as active (e.g. after recovering from an error).
 */
export async function markSourceActive(sourceId: string): Promise<void> {
  try {
    await prisma.source.update({
      where: { id: sourceId },
      data: { status: "ACTIVE" },
    });
    log.info(`Marked source as ACTIVE: ${sourceId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to mark source as active (${sourceId}): ${message}`);
  }
}

// ─── Statistics ────────────────────────────────────────

/**
 * Get a summary of crawler statistics from the database.
 * Useful for logging and monitoring the crawler's progress.
 */
export async function getCrawlerStats(): Promise<{
  totalSources: number;
  activeSources: number;
  errorSources: number;
  totalPosts: number;
  analyzedPosts: number;
  unanalyzedPosts: number;
}> {
  try {
    const [
      totalSources,
      activeSources,
      errorSources,
      totalPosts,
      analyzedPosts,
    ] = await Promise.all([
      prisma.source.count(),
      prisma.source.count({ where: { status: "ACTIVE" } }),
      prisma.source.count({ where: { status: "ERROR" } }),
      prisma.post.count(),
      prisma.post.count({ where: { analyzedAt: { not: null } } }),
    ]);

    const stats = {
      totalSources,
      activeSources,
      errorSources,
      totalPosts,
      analyzedPosts,
      unanalyzedPosts: totalPosts - analyzedPosts,
    };

    log.info("Crawler stats:", stats);
    return stats;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to fetch crawler stats: ${message}`);
    throw new StorageError(`Failed to fetch crawler stats: ${message}`, error);
  }
}

// ─── Error Class ───────────────────────────────────────

/**
 * Custom error class for storage-layer failures.
 */
export class StorageError extends Error {
  public readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "StorageError";
    this.cause = cause;
  }
}
