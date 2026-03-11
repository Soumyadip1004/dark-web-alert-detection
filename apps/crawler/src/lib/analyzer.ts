import prisma from "@dark-web-alert-detection/db/crawler";
import {
  type AlertRecord,
  type AnalysisResult,
  analyzeContent,
} from "@dark-web-alert-detection/detection";

import { createLogger } from "./logger";
import {
  getUnanalyzedPosts,
  markPostAnalyzed,
  type StoredPost,
} from "./storage";

const log = createLogger("analyzer");

// ─── Types ─────────────────────────────────────────────

export interface AnalyzerOptions {
  /** Minimum risk level required to persist alerts. Default: "LOW" */
  minAlertLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** Maximum alerts to generate per post. Default: 20 */
  maxAlertsPerPost: number;
  /** Batch size when processing unanalyzed posts. Default: 50 */
  batchSize: number;
  /** Whether to use the quick pre-filter for performance. Default: false */
  useQuickFilter: boolean;
}

const DEFAULT_OPTIONS: AnalyzerOptions = {
  minAlertLevel: "LOW",
  maxAlertsPerPost: 20,
  batchSize: 50,
  useQuickFilter: false,
};

export interface AnalyzerStats {
  postsAnalyzed: number;
  alertsGenerated: number;
  postsFlagged: number;
  postsClean: number;
  totalAnalysisTimeMs: number;
}

// ─── Single Post Analysis ──────────────────────────────

/**
 * Analyze a single post's content and persist any generated alerts
 * to the database. Marks the post as analyzed regardless of whether
 * alerts were generated.
 *
 * This is the primary function called by the crawler after storing
 * a new post, enabling real-time analysis during crawling.
 *
 * @param post - The stored post to analyze
 * @param options - Optional configuration overrides
 * @returns The analysis result (includes alert details and risk score)
 */
export async function analyzePost(
  post: StoredPost,
  options: Partial<AnalyzerOptions> = {},
): Promise<AnalysisResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = performance.now();

  log.debug(`Analyzing post: ${post.id} (${post.url})`);

  // Run the detection engine on the post content
  const result = analyzeContent(post.content, {
    minAlertLevel: opts.minAlertLevel,
    useQuickFilter: opts.useQuickFilter,
    maxAlertsPerAnalysis: opts.maxAlertsPerPost,
  });

  // Persist alerts if the analysis flagged the content
  if (result.shouldAlert && result.alerts.length > 0) {
    await persistAlerts(post.id, result.alerts);

    log.info(
      `🚨 Post flagged [${result.riskLevel}] (score: ${result.compositeScore.toFixed(1)}): ${post.url} — ` +
        `${result.alerts.length} alert(s) generated`,
    );
  } else {
    log.debug(
      `✓ Post clean [${result.riskLevel}] (score: ${result.compositeScore.toFixed(1)}): ${post.url}`,
    );
  }

  // Mark the post as analyzed (even if no alerts were generated)
  try {
    await markPostAnalyzed(post.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to mark post as analyzed (${post.id}): ${message}`);
  }

  const elapsed = Math.round((performance.now() - startTime) * 100) / 100;
  log.debug(`Analysis complete (${elapsed}ms): ${post.url}`);

  return result;
}

// ─── Batch Analysis ────────────────────────────────────

/**
 * Process all unanalyzed posts in the database in batches.
 *
 * This is useful for:
 *   - Running analysis as a separate background job
 *   - Re-analyzing posts after detection rules are updated
 *   - Catching up on posts that were crawled before the analyzer was running
 *
 * @param options - Optional configuration overrides
 * @returns Cumulative statistics for the entire batch run
 */
export async function analyzeUnanalyzedPosts(
  options: Partial<AnalyzerOptions> = {},
): Promise<AnalyzerStats> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const stats: AnalyzerStats = {
    postsAnalyzed: 0,
    alertsGenerated: 0,
    postsFlagged: 0,
    postsClean: 0,
    totalAnalysisTimeMs: 0,
  };

  const batchStart = performance.now();

  log.info(`Starting batch analysis (batchSize=${opts.batchSize})...`);

  // Process in batches to avoid loading too many posts into memory
  let hasMore = true;

  while (hasMore) {
    const posts = await getUnanalyzedPosts(opts.batchSize);

    if (posts.length === 0) {
      hasMore = false;
      break;
    }

    log.info(`Processing batch of ${posts.length} unanalyzed post(s)...`);

    for (const post of posts) {
      try {
        const result = await analyzePost(post, opts);

        stats.postsAnalyzed++;

        if (result.shouldAlert) {
          stats.postsFlagged++;
          stats.alertsGenerated += result.alerts.length;
        } else {
          stats.postsClean++;
        }

        stats.totalAnalysisTimeMs += result.analysisTimeMs;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error(`Failed to analyze post ${post.id}: ${message}`);

        // Still mark it as analyzed to avoid infinite retry loops
        try {
          await markPostAnalyzed(post.id);
        } catch {
          // Swallow — we already logged the primary error
        }

        stats.postsAnalyzed++;
      }
    }

    // If we got fewer posts than the batch size, we're done
    if (posts.length < opts.batchSize) {
      hasMore = false;
    }
  }

  const totalElapsed = Math.round(performance.now() - batchStart);

  log.info(
    `Batch analysis complete (${totalElapsed}ms): ` +
      `${stats.postsAnalyzed} analyzed, ` +
      `${stats.postsFlagged} flagged, ` +
      `${stats.postsClean} clean, ` +
      `${stats.alertsGenerated} alert(s) generated`,
  );

  return stats;
}

// ─── Alert Persistence ─────────────────────────────────

/**
 * Persist an array of alert records to the database for a given post.
 * Uses createMany for efficient bulk insertion.
 *
 * @param postId - The post ID to associate alerts with
 * @param alerts - Alert records generated by the detection engine
 */
async function persistAlerts(
  postId: string,
  alerts: AlertRecord[],
): Promise<void> {
  if (alerts.length === 0) return;

  try {
    const data = alerts.map(alert => ({
      postId,
      bankName: alert.bankName,
      leakType: alert.leakType,
      riskLevel: alert.riskLevel,
      matchedData: truncateMatchedData(alert.matchedData),
      detectedAt: new Date(),
    }));

    const result = await prisma.alert.createMany({ data });

    log.info(`Persisted ${result.count} alert(s) for post ${postId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(
      `Failed to persist ${alerts.length} alert(s) for post ${postId}: ${message}`,
    );
    throw new AnalyzerError(`Failed to persist alerts: ${message}`, error);
  }
}

// ─── Statistics ────────────────────────────────────────

/**
 * Get a summary of alert statistics from the database.
 * Useful for logging, monitoring, and the dashboard.
 */
export async function getAlertStats(): Promise<{
  totalAlerts: number;
  unreviewedAlerts: number;
  alertsByRiskLevel: Record<string, number>;
  alertsByLeakType: Record<string, number>;
  recentAlerts: number;
}> {
  try {
    const [
      totalAlerts,
      unreviewedAlerts,
      riskLevelGroups,
      leakTypeGroups,
      recentAlerts,
    ] = await Promise.all([
      prisma.alert.count(),
      prisma.alert.count({ where: { reviewed: false } }),
      prisma.alert.groupBy({
        by: ["riskLevel"],
        _count: { id: true },
      }),
      prisma.alert.groupBy({
        by: ["leakType"],
        _count: { id: true },
      }),
      prisma.alert.count({
        where: {
          detectedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // last 24h
          },
        },
      }),
    ]);

    const alertsByRiskLevel: Record<string, number> = {};
    for (const group of riskLevelGroups) {
      alertsByRiskLevel[group.riskLevel] = group._count.id;
    }

    const alertsByLeakType: Record<string, number> = {};
    for (const group of leakTypeGroups) {
      alertsByLeakType[group.leakType] = group._count.id;
    }

    const stats = {
      totalAlerts,
      unreviewedAlerts,
      alertsByRiskLevel,
      alertsByLeakType,
      recentAlerts,
    };

    log.info("Alert stats:", stats);
    return stats;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to fetch alert stats: ${message}`);
    throw new AnalyzerError(`Failed to fetch alert stats: ${message}`, error);
  }
}

// ─── Utilities ─────────────────────────────────────────

/**
 * Truncate the matchedData string to a reasonable length for DB storage.
 * PostgreSQL TEXT columns can handle large strings, but we keep it
 * manageable for dashboard rendering and API responses.
 */
function truncateMatchedData(data: string, maxLength = 2000): string {
  if (data.length <= maxLength) return data;
  return `${data.slice(0, maxLength - 3)}...`;
}

// ─── Error Class ───────────────────────────────────────

/**
 * Custom error class for analyzer-layer failures.
 */
export class AnalyzerError extends Error {
  public readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AnalyzerError";
    this.cause = cause;
  }
}
