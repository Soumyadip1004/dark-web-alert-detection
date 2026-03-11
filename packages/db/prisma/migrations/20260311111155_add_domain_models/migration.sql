-- CreateEnum
CREATE TYPE "SourceCategory" AS ENUM ('BREACH_FORUM', 'MARKETPLACE', 'PASTE_SITE', 'LEAK_SITE', 'OTHER');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'ERROR');

-- CreateEnum
CREATE TYPE "LeakType" AS ENUM ('CREDIT_CARD', 'CREDENTIAL_DUMP', 'BANK_DATA', 'PII', 'OTHER');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category" "SourceCategory" NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "SourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "loginRequired" BOOLEAN NOT NULL DEFAULT false,
    "lastCrawledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "author" TEXT,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analyzedAt" TIMESTAMP(3),

    CONSTRAINT "post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "bankName" TEXT,
    "leakType" "LeakType" NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "matchedData" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "source_url_key" ON "source"("url");

-- CreateIndex
CREATE INDEX "source_category_idx" ON "source"("category");

-- CreateIndex
CREATE INDEX "source_status_idx" ON "source"("status");

-- CreateIndex
CREATE UNIQUE INDEX "post_url_key" ON "post"("url");

-- CreateIndex
CREATE INDEX "post_sourceId_idx" ON "post"("sourceId");

-- CreateIndex
CREATE INDEX "post_scrapedAt_idx" ON "post"("scrapedAt");

-- CreateIndex
CREATE INDEX "alert_postId_idx" ON "alert"("postId");

-- CreateIndex
CREATE INDEX "alert_riskLevel_idx" ON "alert"("riskLevel");

-- CreateIndex
CREATE INDEX "alert_detectedAt_idx" ON "alert"("detectedAt");

-- CreateIndex
CREATE INDEX "alert_reviewed_idx" ON "alert"("reviewed");

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert" ADD CONSTRAINT "alert_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
