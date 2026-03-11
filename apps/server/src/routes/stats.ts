import prisma from "@dark-web-alert-detection/db";
import { Elysia, t } from "elysia";

/**
 * Stats routes — aggregated dashboard summary statistics.
 *
 * Endpoints:
 *   GET /api/stats          — Overall dashboard summary
 *   GET /api/stats/timeline — Alerts over time (grouped by day)
 */
export const statsRoutes = new Elysia({ prefix: "/api/stats" })

  // ─── GET /api/stats ────────────────────────────────────
  .get(
    "/",
    async () => {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        totalAlerts,
        unreviewedAlerts,
        alertsLast24h,
        alertsLast7d,
        alertsLast30d,
        criticalAlerts,
        highAlerts,
        mediumAlerts,
        lowAlerts,
        totalSources,
        activeSources,
        totalPosts,
        postsLast24h,
        alertsByLeakType,
        alertsByRiskLevel,
        recentAlerts,
        topBanks,
      ] = await Promise.all([
        // Total alerts
        prisma.alert.count(),

        // Unreviewed alerts
        prisma.alert.count({ where: { reviewed: false } }),

        // Alerts in the last 24 hours
        prisma.alert.count({
          where: { detectedAt: { gte: twentyFourHoursAgo } },
        }),

        // Alerts in the last 7 days
        prisma.alert.count({
          where: { detectedAt: { gte: sevenDaysAgo } },
        }),

        // Alerts in the last 30 days
        prisma.alert.count({
          where: { detectedAt: { gte: thirtyDaysAgo } },
        }),

        // Alerts by risk level
        prisma.alert.count({ where: { riskLevel: "CRITICAL" } }),
        prisma.alert.count({ where: { riskLevel: "HIGH" } }),
        prisma.alert.count({ where: { riskLevel: "MEDIUM" } }),
        prisma.alert.count({ where: { riskLevel: "LOW" } }),

        // Source counts
        prisma.source.count(),
        prisma.source.count({ where: { status: "ACTIVE" } }),

        // Post counts
        prisma.post.count(),
        prisma.post.count({
          where: { scrapedAt: { gte: twentyFourHoursAgo } },
        }),

        // Alerts grouped by leak type
        prisma.alert.groupBy({
          by: ["leakType"],
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
        }),

        // Alerts grouped by risk level
        prisma.alert.groupBy({
          by: ["riskLevel"],
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
        }),

        // 5 most recent alerts
        prisma.alert.findMany({
          orderBy: { detectedAt: "desc" },
          take: 5,
          select: {
            id: true,
            bankName: true,
            leakType: true,
            riskLevel: true,
            matchedData: true,
            detectedAt: true,
            reviewed: true,
            post: {
              select: {
                id: true,
                title: true,
                url: true,
                source: {
                  select: {
                    id: true,
                    name: true,
                    category: true,
                  },
                },
              },
            },
          },
        }),

        // Top 10 most-mentioned banks
        prisma.alert.groupBy({
          by: ["bankName"],
          where: { bankName: { not: null } },
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 10,
        }),
      ]);

      // Normalize grouped results into clean objects
      const byLeakType: Record<string, number> = {};
      for (const row of alertsByLeakType) {
        byLeakType[row.leakType] = row._count.id;
      }

      const byRiskLevel: Record<string, number> = {};
      for (const row of alertsByRiskLevel) {
        byRiskLevel[row.riskLevel] = row._count.id;
      }

      const banks = topBanks.map(row => ({
        bankName: row.bankName,
        count: row._count.id,
      }));

      return {
        data: {
          alerts: {
            total: totalAlerts,
            unreviewed: unreviewedAlerts,
            last24h: alertsLast24h,
            last7d: alertsLast7d,
            last30d: alertsLast30d,
            byRiskLevel: {
              CRITICAL: criticalAlerts,
              HIGH: highAlerts,
              MEDIUM: mediumAlerts,
              LOW: lowAlerts,
            },
            byLeakType,
          },
          sources: {
            total: totalSources,
            active: activeSources,
          },
          posts: {
            total: totalPosts,
            last24h: postsLast24h,
          },
          topBanks: banks,
          recentAlerts,
        },
      };
    },
    {
      detail: {
        summary: "Dashboard stats",
        description:
          "Returns aggregated statistics for the dashboard: alert counts, breakdowns by risk level and leak type, source/post counts, top banks, and recent alerts.",
        tags: ["Stats"],
      },
    },
  )

  // ─── GET /api/stats/timeline ───────────────────────────
  .get(
    "/timeline",
    async ({ query }) => {
      const days = Math.min(90, Math.max(1, query.days ?? 30));
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      // Fetch all alerts in the date range
      const alerts = await prisma.alert.findMany({
        where: {
          detectedAt: { gte: startDate },
        },
        select: {
          detectedAt: true,
          riskLevel: true,
        },
        orderBy: { detectedAt: "asc" },
      });

      // Group by day
      const timeline: Record<
        string,
        {
          date: string;
          total: number;
          CRITICAL: number;
          HIGH: number;
          MEDIUM: number;
          LOW: number;
        }
      > = {};

      // Initialize all days with zeroes so there are no gaps
      for (let i = 0; i <= days; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().split("T")[0] as string;
        timeline[key] = {
          date: key,
          total: 0,
          CRITICAL: 0,
          HIGH: 0,
          MEDIUM: 0,
          LOW: 0,
        };
      }

      for (const alert of alerts) {
        const key = alert.detectedAt.toISOString().split("T")[0] as string;
        const bucket = timeline[key];
        if (bucket) {
          bucket.total++;
          bucket[alert.riskLevel as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"]++;
        }
      }

      return {
        data: Object.values(timeline),
      };
    },
    {
      query: t.Object({
        days: t.Optional(t.Numeric()),
      }),
      detail: {
        summary: "Alert timeline",
        description:
          "Returns alert counts grouped by day for the specified number of days, broken down by risk level. Useful for charting alerts over time.",
        tags: ["Stats"],
      },
    },
  );
