import prisma from "@dark-web-alert-detection/db";
import { Elysia, t } from "elysia";

/**
 * Source routes — CRUD for monitored dark-web sources.
 *
 * Endpoints:
 *   GET    /api/sources          — Paginated list with filters
 *   GET    /api/sources/:id      — Single source detail (includes post count)
 *   POST   /api/sources          — Add a new monitored source
 *   PATCH  /api/sources/:id      — Update an existing source
 *   DELETE /api/sources/:id      — Remove a source (cascades to posts & alerts)
 */
export const sourceRoutes = new Elysia({ prefix: "/api/sources" })

  // ─── GET /api/sources ──────────────────────────────────
  .get(
    "/",
    async ({ query }) => {
      const page = Math.max(1, query.page ?? 1);
      const limit = Math.min(100, Math.max(1, query.limit ?? 20));
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};

      if (query.category) {
        where.category = query.category;
      }

      if (query.status) {
        where.status = query.status;
      }

      if (query.priority) {
        where.priority = query.priority;
      }

      if (query.search) {
        where.OR = [
          { name: { contains: query.search, mode: "insensitive" } },
          { url: { contains: query.search, mode: "insensitive" } },
        ];
      }

      const sortField = query.sortBy ?? "createdAt";
      const sortDir = query.sortDir ?? "desc";

      const [sources, total] = await Promise.all([
        prisma.source.findMany({
          where,
          include: {
            _count: {
              select: { posts: true },
            },
          },
          orderBy: { [sortField]: sortDir },
          skip,
          take: limit,
        }),
        prisma.source.count({ where }),
      ]);

      return {
        data: sources,
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
        category: t.Optional(
          t.Union([
            t.Literal("BREACH_FORUM"),
            t.Literal("MARKETPLACE"),
            t.Literal("PASTE_SITE"),
            t.Literal("LEAK_SITE"),
            t.Literal("OTHER"),
          ]),
        ),
        status: t.Optional(
          t.Union([
            t.Literal("ACTIVE"),
            t.Literal("INACTIVE"),
            t.Literal("BLOCKED"),
            t.Literal("ERROR"),
          ]),
        ),
        priority: t.Optional(
          t.Union([
            t.Literal("LOW"),
            t.Literal("MEDIUM"),
            t.Literal("HIGH"),
            t.Literal("CRITICAL"),
          ]),
        ),
        search: t.Optional(t.String()),
        sortBy: t.Optional(
          t.Union([
            t.Literal("createdAt"),
            t.Literal("name"),
            t.Literal("priority"),
            t.Literal("status"),
            t.Literal("lastCrawledAt"),
          ]),
        ),
        sortDir: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
      }),
      detail: {
        summary: "List sources",
        description:
          "Returns a paginated, filterable list of monitored dark-web sources.",
        tags: ["Sources"],
      },
    },
  )

  // ─── GET /api/sources/:id ──────────────────────────────
  .get(
    "/:id",
    async ({ params, set }) => {
      const source = await prisma.source.findUnique({
        where: { id: params.id },
        include: {
          _count: {
            select: { posts: true },
          },
          posts: {
            orderBy: { scrapedAt: "desc" },
            take: 10,
            select: {
              id: true,
              url: true,
              title: true,
              author: true,
              scrapedAt: true,
              analyzedAt: true,
              _count: {
                select: { alerts: true },
              },
            },
          },
        },
      });

      if (!source) {
        set.status = 404;
        return { error: "Source not found" };
      }

      return { data: source };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: "Get source detail",
        description:
          "Returns a single source with post count and its most recent posts.",
        tags: ["Sources"],
      },
    },
  )

  // ─── POST /api/sources ─────────────────────────────────
  .post(
    "/",
    async ({ body, set }) => {
      // Check for duplicate URL
      const existing = await prisma.source.findUnique({
        where: { url: body.url },
      });

      if (existing) {
        set.status = 409;
        return {
          error: "A source with this URL already exists",
          existingId: existing.id,
        };
      }

      const source = await prisma.source.create({
        data: {
          name: body.name,
          url: body.url,
          category: body.category,
          priority: body.priority ?? "MEDIUM",
          status: body.status ?? "ACTIVE",
          loginRequired: body.loginRequired ?? false,
        },
      });

      set.status = 201;
      return { data: source };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        url: t.String({ minLength: 1 }),
        category: t.Union([
          t.Literal("BREACH_FORUM"),
          t.Literal("MARKETPLACE"),
          t.Literal("PASTE_SITE"),
          t.Literal("LEAK_SITE"),
          t.Literal("OTHER"),
        ]),
        priority: t.Optional(
          t.Union([
            t.Literal("LOW"),
            t.Literal("MEDIUM"),
            t.Literal("HIGH"),
            t.Literal("CRITICAL"),
          ]),
        ),
        status: t.Optional(
          t.Union([
            t.Literal("ACTIVE"),
            t.Literal("INACTIVE"),
            t.Literal("BLOCKED"),
            t.Literal("ERROR"),
          ]),
        ),
        loginRequired: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: "Create source",
        description:
          "Add a new dark-web source to be monitored by the crawler.",
        tags: ["Sources"],
      },
    },
  )

  // ─── PATCH /api/sources/:id ────────────────────────────
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const existing = await prisma.source.findUnique({
        where: { id: params.id },
      });

      if (!existing) {
        set.status = 404;
        return { error: "Source not found" };
      }

      // If updating the URL, check for duplicates (excluding this source)
      if (body.url && body.url !== existing.url) {
        const duplicate = await prisma.source.findUnique({
          where: { url: body.url },
        });
        if (duplicate) {
          set.status = 409;
          return {
            error: "A source with this URL already exists",
            existingId: duplicate.id,
          };
        }
      }

      // Build a clean update object — only include provided fields
      const data: Record<string, unknown> = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.url !== undefined) data.url = body.url;
      if (body.category !== undefined) data.category = body.category;
      if (body.priority !== undefined) data.priority = body.priority;
      if (body.status !== undefined) data.status = body.status;
      if (body.loginRequired !== undefined)
        data.loginRequired = body.loginRequired;

      const updated = await prisma.source.update({
        where: { id: params.id },
        data,
      });

      return { data: updated };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        url: t.Optional(t.String({ minLength: 1 })),
        category: t.Optional(
          t.Union([
            t.Literal("BREACH_FORUM"),
            t.Literal("MARKETPLACE"),
            t.Literal("PASTE_SITE"),
            t.Literal("LEAK_SITE"),
            t.Literal("OTHER"),
          ]),
        ),
        priority: t.Optional(
          t.Union([
            t.Literal("LOW"),
            t.Literal("MEDIUM"),
            t.Literal("HIGH"),
            t.Literal("CRITICAL"),
          ]),
        ),
        status: t.Optional(
          t.Union([
            t.Literal("ACTIVE"),
            t.Literal("INACTIVE"),
            t.Literal("BLOCKED"),
            t.Literal("ERROR"),
          ]),
        ),
        loginRequired: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: "Update source",
        description:
          "Partially update a monitored source. Only provided fields are changed.",
        tags: ["Sources"],
      },
    },
  )

  // ─── DELETE /api/sources/:id ───────────────────────────
  .delete(
    "/:id",
    async ({ params, set }) => {
      const existing = await prisma.source.findUnique({
        where: { id: params.id },
      });

      if (!existing) {
        set.status = 404;
        return { error: "Source not found" };
      }

      // Cascade delete is handled by the Prisma schema (onDelete: Cascade on Post)
      // which in turn cascades to Alert via Post's onDelete: Cascade
      await prisma.source.delete({
        where: { id: params.id },
      });

      set.status = 200;
      return { data: { id: params.id, deleted: true } };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: "Delete source",
        description:
          "Remove a source and all its associated posts and alerts (cascade delete).",
        tags: ["Sources"],
      },
    },
  );
