import prisma from "@dark-web-alert-detection/db";
import { Elysia, t } from "elysia";

/**
 * Alert routes — CRUD + review workflow for generated alerts.
 *
 * Endpoints:
 *   GET    /api/alerts          — Paginated list with filters
 *   GET    /api/alerts/:id      — Single alert detail (includes post + source)
 *   PATCH  /api/alerts/:id/review — Mark/unmark an alert as reviewed
 */
export const alertRoutes = new Elysia({ prefix: "/api/alerts" })

  // ─── GET /api/alerts ───────────────────────────────────
  .get(
    "/",
    async ({ query }) => {
      const page = Math.max(1, query.page ?? 1);
      const limit = Math.min(100, Math.max(1, query.limit ?? 20));
      const skip = (page - 1) * limit;

      // Build dynamic where clause from query filters
      const where: Record<string, unknown> = {};

      if (query.riskLevel) {
        where.riskLevel = query.riskLevel;
      }

      if (query.leakType) {
        where.leakType = query.leakType;
      }

      if (query.reviewed !== undefined && query.reviewed !== null) {
        where.reviewed = query.reviewed;
      }

      if (query.bankName) {
        where.bankName = { contains: query.bankName, mode: "insensitive" };
      }

      if (query.search) {
        where.matchedData = { contains: query.search, mode: "insensitive" };
      }

      // Date range filter on detectedAt
      if (query.from || query.to) {
        const detectedAt: Record<string, Date> = {};
        if (query.from) detectedAt.gte = new Date(query.from);
        if (query.to) detectedAt.lte = new Date(query.to);
        where.detectedAt = detectedAt;
      }

      // Determine sort order
      const sortField = query.sortBy ?? "detectedAt";
      const sortDir = query.sortDir ?? "desc";

      const [alerts, total] = await Promise.all([
        prisma.alert.findMany({
          where,
          include: {
            post: {
              select: {
                id: true,
                url: true,
                title: true,
                author: true,
                scrapedAt: true,
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
          orderBy: { [sortField]: sortDir },
          skip,
          take: limit,
        }),
        prisma.alert.count({ where }),
      ]);

      return {
        data: alerts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      };
    },
    {
      query: t.Object({
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
        riskLevel: t.Optional(
          t.Union([
            t.Literal("LOW"),
            t.Literal("MEDIUM"),
            t.Literal("HIGH"),
            t.Literal("CRITICAL"),
          ]),
        ),
        leakType: t.Optional(
          t.Union([
            t.Literal("CREDIT_CARD"),
            t.Literal("CREDENTIAL_DUMP"),
            t.Literal("BANK_DATA"),
            t.Literal("PII"),
            t.Literal("OTHER"),
          ]),
        ),
        reviewed: t.Optional(t.BooleanString()),
        bankName: t.Optional(t.String()),
        search: t.Optional(t.String()),
        from: t.Optional(t.String({ format: "date-time" })),
        to: t.Optional(t.String({ format: "date-time" })),
        sortBy: t.Optional(
          t.Union([
            t.Literal("detectedAt"),
            t.Literal("riskLevel"),
            t.Literal("leakType"),
            t.Literal("bankName"),
          ]),
        ),
        sortDir: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
      }),
      detail: {
        summary: "List alerts",
        description:
          "Returns a paginated, filterable list of alerts with related post and source info.",
        tags: ["Alerts"],
      },
    },
  )

  // ─── GET /api/alerts/:id ───────────────────────────────
  .get(
    "/:id",
    async ({ params, set }) => {
      const alert = await prisma.alert.findUnique({
        where: { id: params.id },
        include: {
          post: {
            include: {
              source: true,
            },
          },
        },
      });

      if (!alert) {
        set.status = 404;
        return { error: "Alert not found" };
      }

      return { data: alert };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: "Get alert detail",
        description:
          "Returns a single alert with its full post content and source information.",
        tags: ["Alerts"],
      },
    },
  )

  // ─── PATCH /api/alerts/:id/review ──────────────────────
  .patch(
    "/:id/review",
    async ({ params, body, set }) => {
      // Check the alert exists first
      const existing = await prisma.alert.findUnique({
        where: { id: params.id },
      });

      if (!existing) {
        set.status = 404;
        return { error: "Alert not found" };
      }

      const reviewed = body.reviewed ?? !existing.reviewed;

      const updated = await prisma.alert.update({
        where: { id: params.id },
        data: {
          reviewed,
          reviewedBy: reviewed ? (body.reviewedBy ?? null) : null,
          reviewedAt: reviewed ? new Date() : null,
        },
      });

      return { data: updated };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        reviewed: t.Optional(t.Boolean()),
        reviewedBy: t.Optional(t.String()),
      }),
      detail: {
        summary: "Review an alert",
        description:
          "Mark or unmark an alert as reviewed. If `reviewed` is omitted, it toggles the current state.",
        tags: ["Alerts"],
      },
    },
  );
