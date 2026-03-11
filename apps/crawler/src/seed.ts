import prisma from "@dark-web-alert-detection/db/crawler";

import { createLogger } from "./lib/logger";

const log = createLogger("seed");

/**
 * Seed sources for the crawler.
 *
 * These are split into two categories:
 *   1. Clearnet test sources — real, publicly accessible websites
 *      used to verify the crawler works end-to-end before pointing
 *      it at .onion addresses.
 *   2. Onion placeholder sources — example .onion URLs that you
 *      should replace with real dark-web sources you want to monitor.
 *
 * Run with: bun run seed
 */

interface SeedSource {
  name: string;
  url: string;
  category:
    | "BREACH_FORUM"
    | "MARKETPLACE"
    | "PASTE_SITE"
    | "LEAK_SITE"
    | "OTHER";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  loginRequired: boolean;
}

const CLEARNET_TEST_SOURCES: SeedSource[] = [
  {
    name: "Example.com (test)",
    url: "https://example.com",
    category: "OTHER",
    priority: "LOW",
    loginRequired: false,
  },
  {
    name: "Tor Project Check (test)",
    url: "https://check.torproject.org",
    category: "OTHER",
    priority: "LOW",
    loginRequired: false,
  },
  {
    name: "Pastebin Trending (test)",
    url: "https://pastebin.com/trends",
    category: "PASTE_SITE",
    priority: "MEDIUM",
    loginRequired: false,
  },
];

const ONION_PLACEHOLDER_SOURCES: SeedSource[] = [
  // ──────────────────────────────────────────────────────────
  // IMPORTANT: Replace these placeholder URLs with real .onion
  // addresses you want to monitor. These are fake examples.
  // ──────────────────────────────────────────────────────────
  {
    name: "Example Forum (placeholder)",
    url: "http://exampleforumxxxxxxxxxxxx.onion",
    category: "BREACH_FORUM",
    priority: "HIGH",
    loginRequired: false,
  },
  {
    name: "Example Paste (placeholder)",
    url: "http://examplepastexxxxxxxxxxxxx.onion",
    category: "PASTE_SITE",
    priority: "MEDIUM",
    loginRequired: false,
  },
  {
    name: "Example Leak Site (placeholder)",
    url: "http://exampleleakxxxxxxxxxxxxx.onion",
    category: "LEAK_SITE",
    priority: "CRITICAL",
    loginRequired: false,
  },
];

async function seed() {
  log.info("Starting database seed...");

  // By default only seed clearnet test sources.
  // Set SEED_ONION=true to also add the onion placeholders.
  const includeOnion = process.env.SEED_ONION === "true";

  const sources: SeedSource[] = [
    ...CLEARNET_TEST_SOURCES,
    ...(includeOnion ? ONION_PLACEHOLDER_SOURCES : []),
  ];

  log.info(
    `Seeding ${sources.length} source(s) (onion placeholders: ${includeOnion ? "included" : "skipped"})`,
  );

  let created = 0;
  let skipped = 0;

  for (const source of sources) {
    try {
      const existing = await prisma.source.findUnique({
        where: { url: source.url },
      });

      if (existing) {
        log.info(`  ⏭  Skipping (already exists): ${source.name}`);
        skipped++;
        continue;
      }

      await prisma.source.create({
        data: {
          name: source.name,
          url: source.url,
          category: source.category,
          priority: source.priority,
          status: "ACTIVE",
          loginRequired: source.loginRequired,
        },
      });

      log.info(`  ✓  Created: ${source.name} (${source.url})`);
      created++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`  ✗  Failed to seed "${source.name}": ${message}`);
    }
  }

  log.info("");
  log.info("Seed complete!");
  log.info(`  Created: ${created}`);
  log.info(`  Skipped: ${skipped}`);
  log.info(`  Total:   ${sources.length}`);

  // Verify by listing all sources
  const allSources = await prisma.source.findMany({
    orderBy: { priority: "desc" },
  });

  log.info("");
  log.info(`All sources in database (${allSources.length}):`);
  for (const s of allSources) {
    log.info(`  [${s.priority}] ${s.name} — ${s.status} — ${s.url}`);
  }
}

seed()
  .catch(error => {
    log.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
