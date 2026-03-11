import { auth } from "@dark-web-alert-detection/auth";
import { env } from "@dark-web-alert-detection/env/server";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { alertRoutes } from "./routes/alerts";
import { sourceRoutes } from "./routes/sources";
import { statsRoutes } from "./routes/stats";

export const app = new Elysia()
  .use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  )

  // ─── Auth (better-auth catch-all) ────────────────────
  .all("/api/auth/*", async context => {
    const { request, status } = context;
    if (["POST", "GET"].includes(request.method)) {
      return auth.handler(request);
    }
    return status(405);
  })

  // ─── Domain API routes ───────────────────────────────
  .use(alertRoutes)
  .use(sourceRoutes)
  .use(statsRoutes)

  // ─── Health check ────────────────────────────────────
  .get("/", () => "OK")

  .listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
  });
