import { env } from "@dark-web-alert-detection/env/crawler";
import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../prisma/generated/client";

const adapter = new PrismaNeon({
  connectionString: env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

export default prisma;

// Re-export enums so other packages can import them directly
export {
  LeakType,
  Priority,
  RiskLevel,
  SourceCategory,
  SourceStatus,
} from "../prisma/generated/enums";

// Re-export model types for use across packages
export type {
  AlertModel as Alert,
  PostModel as Post,
  SourceModel as Source,
} from "../prisma/generated/models";
