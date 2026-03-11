import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    TOR_PROXY_URL: z.string().default("socks5h://127.0.0.1:9050"),
    CRAWLER_CONCURRENCY: z.coerce.number().int().positive().default(3),
    CRAWLER_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
    CRAWLER_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(30000),
    CRAWLER_MAX_RETRIES: z.coerce.number().int().nonnegative().default(3),
    CRAWLER_MAX_DEPTH: z.coerce.number().int().nonnegative().default(3),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
