import { env } from "@dark-web-alert-detection/env/crawler";

import { Crawler } from "./lib/crawler";
import { createLogger } from "./lib/logger";

const log = createLogger("main");

/**
 * Dark Web Crawler — Main Entry Point
 *
 * This is the top-level process that:
 *   1. Initializes the crawler with config from environment variables
 *   2. Registers graceful shutdown handlers (SIGINT, SIGTERM)
 *   3. Starts the crawler's continuous loop
 *
 * Run with:
 *   bun run dev       (hot-reload during development)
 *   bun run start     (production)
 */

const crawler = new Crawler({
  torProxyUrl: env.TOR_PROXY_URL,
  concurrency: env.CRAWLER_CONCURRENCY,
  intervalMs: env.CRAWLER_INTERVAL_MS,
  requestTimeoutMs: env.CRAWLER_REQUEST_TIMEOUT_MS,
  maxRetries: env.CRAWLER_MAX_RETRIES,
  maxDepth: env.CRAWLER_MAX_DEPTH,
});

// ─── Graceful Shutdown ───────────────────────────────────

let shuttingDown = false;

function handleShutdown(signal: string) {
  if (shuttingDown) {
    log.warn(`Received ${signal} again — forcing exit`);
    process.exit(1);
  }

  shuttingDown = true;
  log.info(`Received ${signal} — initiating graceful shutdown...`);

  crawler.stop();

  // Force exit after 15 seconds if graceful shutdown hangs
  const forceExitTimer = setTimeout(() => {
    log.error("Graceful shutdown timed out after 15s — forcing exit");
    process.exit(1);
  }, 15_000);

  // Don't let this timer keep the process alive
  forceExitTimer.unref();
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

process.on("uncaughtException", error => {
  log.error(`Uncaught exception: ${error.message}`, error);
  handleShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  log.error(`Unhandled rejection: ${message}`, reason);
});

// ─── Start ───────────────────────────────────────────────

log.info("═══════════════════════════════════════════════════");
log.info("  Dark Web Alert Detection — Crawler Service");
log.info("═══════════════════════════════════════════════════");
log.info("");
log.info(`  Tor Proxy:     ${env.TOR_PROXY_URL}`);
log.info(`  Concurrency:   ${env.CRAWLER_CONCURRENCY}`);
log.info(`  Interval:      ${env.CRAWLER_INTERVAL_MS}ms`);
log.info(`  Timeout:       ${env.CRAWLER_REQUEST_TIMEOUT_MS}ms`);
log.info(`  Max Retries:   ${env.CRAWLER_MAX_RETRIES}`);
log.info(`  Max Depth:     ${env.CRAWLER_MAX_DEPTH}`);
log.info(`  Environment:   ${env.NODE_ENV}`);
log.info("");

crawler
  .start()
  .then(() => {
    log.info("Crawler has exited");
    process.exit(0);
  })
  .catch(error => {
    log.error("Crawler failed to start:", error);
    process.exit(1);
  });
