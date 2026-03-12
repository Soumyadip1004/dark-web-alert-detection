"use client";

import { Badge } from "@dark-web-alert-detection/ui/components/badge";
import { Button } from "@dark-web-alert-detection/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@dark-web-alert-detection/ui/components/card";
import { Separator } from "@dark-web-alert-detection/ui/components/separator";
import { Skeleton } from "@dark-web-alert-detection/ui/components/skeleton";
import { cn } from "@dark-web-alert-detection/ui/lib/utils";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Fingerprint,
  Globe,
  KeyRound,
  Loader2,
  Shield,
  ShieldAlert,
  User,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  type Alert,
  type AlertEvidence,
  fetchAlert,
  formatDateTime,
  formatRelativeTime,
  LEAK_TYPE_CONFIG,
  RISK_LEVEL_CONFIG,
  reviewAlert,
  SOURCE_CATEGORY_CONFIG,
  SOURCE_STATUS_CONFIG,
} from "@/lib/api";
import { route } from "@/lib/routes";

// ─── Evidence Card ─────────────────────────────────────

function EvidenceCard({ evidence }: { evidence: AlertEvidence }) {
  const hasPatterns = evidence.patternMatches.length > 0;
  const hasKeywords = evidence.keywordHits.length > 0;
  const hasBanks = evidence.bankMentions.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Fingerprint className="size-4 text-destructive" />
          <CardTitle className="text-base">Evidence</CardTitle>
        </div>
        <CardDescription>
          Actual problematic data detected — risk score{" "}
          <span className="font-semibold tabular-nums">
            {evidence.compositeScore}
          </span>
          /100
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Risk Summary */}
        {evidence.riskSummary && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <p className="text-sm leading-relaxed">{evidence.riskSummary}</p>
          </div>
        )}

        {/* Pattern Matches */}
        {hasPatterns && (
          <div className="space-y-2">
            <h4 className="flex items-center gap-1.5 font-medium text-sm">
              <Fingerprint className="size-3.5 text-muted-foreground" />
              Pattern Matches
            </h4>
            <div className="space-y-2">
              {evidence.patternMatches.map(pm => (
                <div
                  key={pm.patternId}
                  className="rounded-lg border bg-muted/30 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-xs">
                      {pm.patternName}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {pm.category}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] tabular-nums"
                      >
                        {pm.matchCount} match{pm.matchCount !== 1 ? "es" : ""}
                      </Badge>
                    </div>
                  </div>
                  {pm.samples.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {pm.samples.map((sample, i) => (
                        <code
                          key={i}
                          className="block rounded bg-background px-2 py-1 font-mono text-[11px] text-destructive"
                        >
                          {sample}
                        </code>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Keyword Hits */}
        {hasKeywords && (
          <div className="space-y-2">
            <h4 className="flex items-center gap-1.5 font-medium text-sm">
              <KeyRound className="size-3.5 text-muted-foreground" />
              Keyword Hits
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {evidence.keywordHits.map((kw, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className={cn(
                    "gap-1 text-xs",
                    kw.weight >= 8
                      ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                      : kw.weight >= 6
                        ? "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400"
                        : "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
                  )}
                >
                  {kw.term}
                  <span className="text-[10px] opacity-70">
                    w{kw.weight} ×{kw.count}
                  </span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Bank Mentions */}
        {hasBanks && (
          <div className="space-y-2">
            <h4 className="flex items-center gap-1.5 font-medium text-sm">
              <Shield className="size-3.5 text-muted-foreground" />
              Bank Mentions
            </h4>
            <div className="space-y-2">
              {evidence.bankMentions.map((bm, i) => (
                <div key={i} className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-xs">{bm.bankName}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {bm.region}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] tabular-nums"
                      >
                        {bm.mentionCount} mention
                        {bm.mentionCount !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </div>
                  {bm.contextSnippet && (
                    <div className="mt-2 rounded bg-background px-2 py-1.5">
                      <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
                        …{bm.contextSnippet}…
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Risk Level Badge ──────────────────────────────────

function RiskBadge({
  level,
  size = "sm",
}: {
  level: string;
  size?: "sm" | "lg";
}) {
  const config = RISK_LEVEL_CONFIG[level as keyof typeof RISK_LEVEL_CONFIG];
  if (!config) return <Badge variant="outline">{level}</Badge>;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 border-transparent font-medium",
        config.bgClass,
        config.textClass,
        size === "lg" && "px-3 py-1 text-sm",
      )}
    >
      <span
        className={cn(
          "inline-block rounded-full",
          size === "lg" ? "size-2" : "size-1.5",
          level === "CRITICAL"
            ? "bg-red-500"
            : level === "HIGH"
              ? "bg-orange-500"
              : level === "MEDIUM"
                ? "bg-yellow-500"
                : "bg-green-500",
        )}
      />
      {config.label}
    </Badge>
  );
}

// ─── Detail Row ────────────────────────────────────────

function DetailRow({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      {Icon && (
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <div className="text-xs">{children}</div>
      </div>
    </div>
  );
}

// ─── Skeleton ──────────────────────────────────────────

function AlertDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-7 w-48" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────

export default function AlertDetailPage() {
  const params = useParams();
  const router = useRouter();
  const alertId = params.id as string;

  const [alert, setAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const loadAlert = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchAlert(alertId);
      setAlert(res.data);
    } catch (err) {
      console.error("Failed to load alert:", err);
      setError(err instanceof Error ? err.message : "Failed to load alert");
    } finally {
      setLoading(false);
    }
  }, [alertId]);

  useEffect(() => {
    loadAlert();
  }, [loadAlert]);

  async function handleReview() {
    if (!alert) return;
    try {
      setReviewing(true);
      const res = await reviewAlert(alert.id, { reviewed: !alert.reviewed });
      setAlert(prev => (prev ? { ...prev, ...res.data } : prev));
    } catch (err) {
      console.error("Failed to toggle review:", err);
    } finally {
      setReviewing(false);
    }
  }

  // ─── Loading state ────────────────────────────────
  if (loading) {
    return <AlertDetailSkeleton />;
  }

  // ─── Error state ──────────────────────────────────
  if (error || !alert) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => router.back()}
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShieldAlert className="mb-3 size-10 text-muted-foreground" />
            <p className="mb-1 font-medium text-sm">
              {error ?? "Alert not found"}
            </p>
            <p className="mb-4 text-muted-foreground text-xs">
              The alert may have been deleted or the server is unavailable.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadAlert}>
                Try again
              </Button>
              <Link href={route("/dashboard/alerts")}>
                <Button variant="outline" size="sm">
                  Back to alerts
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const riskConfig = RISK_LEVEL_CONFIG[alert.riskLevel];
  const leakConfig = LEAK_TYPE_CONFIG[alert.leakType];
  const source = alert.post?.source;
  const sourceCategory = source?.category
    ? SOURCE_CATEGORY_CONFIG[
        source.category as keyof typeof SOURCE_CATEGORY_CONFIG
      ]
    : null;
  const sourceStatus = source?.status
    ? SOURCE_STATUS_CONFIG[source.status as keyof typeof SOURCE_STATUS_CONFIG]
    : null;

  return (
    <div className="space-y-6">
      {/* ─── Back + Header ─────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.back()}
            title="Go back"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-xl tracking-tight">
                Alert Detail
              </h1>
              <RiskBadge level={alert.riskLevel} size="lg" />
            </div>
            <p className="mt-0.5 text-muted-foreground text-xs">{alert.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={alert.reviewed ? "outline" : "default"}
            size="sm"
            className="gap-1.5"
            disabled={reviewing}
            onClick={handleReview}
          >
            {reviewing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : alert.reviewed ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
            {alert.reviewed ? "Mark Unreviewed" : "Mark Reviewed"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ─── Left Column: Main Content ─────────── */}
        <div className="space-y-4 lg:col-span-2">
          {/* Matched Data / Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className={cn(
                    "size-4",
                    riskConfig?.textClass ?? "text-muted-foreground",
                  )}
                />
                <CardTitle className="text-base">Detection Summary</CardTitle>
              </div>
              <CardDescription>What triggered this alert</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={cn("rounded-lg border p-4", riskConfig?.bgClass)}>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {alert.matchedData}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ─── Evidence Card ────────────────────── */}
          {alert.evidenceData && <EvidenceCard evidence={alert.evidenceData} />}

          {/* Post Content */}
          {alert.post && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <CardTitle className="text-base">Source Post</CardTitle>
                </div>
                <CardDescription>
                  Original scraped content from the dark web
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Post metadata */}
                <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
                  {alert.post.title && (
                    <span className="font-medium text-foreground">
                      {alert.post.title}
                    </span>
                  )}
                  {alert.post.author && (
                    <span className="flex items-center gap-1">
                      <User className="size-3" />
                      {alert.post.author}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    Scraped {formatRelativeTime(alert.post.scrapedAt)}
                  </span>
                </div>

                <Separator />

                {/* Post content */}
                {alert.post.content ? (
                  <div className="max-h-[400px] overflow-y-auto rounded-lg bg-muted/50 p-4">
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
                      {alert.post.content}
                    </pre>
                  </div>
                ) : (
                  <div className="flex items-center justify-center rounded-lg border border-dashed py-8">
                    <p className="text-muted-foreground text-xs">
                      Full post content is not available in detail view.
                    </p>
                  </div>
                )}

                {/* Post URL */}
                {alert.post.url && (
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                    <Globe className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground">
                      {alert.post.url}
                    </span>
                    <a
                      href={alert.post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-primary hover:underline"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ─── Right Column: Metadata ────────────── */}
        <div className="space-y-4">
          {/* Alert Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Alert Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <DetailRow label="Risk Level" icon={Shield}>
                <RiskBadge level={alert.riskLevel} />
              </DetailRow>

              <Separator />

              <DetailRow label="Leak Type" icon={AlertTriangle}>
                <div className="flex items-center gap-1.5">
                  <span>{leakConfig?.icon ?? "📄"}</span>
                  <span className="font-medium">
                    {leakConfig?.label ?? alert.leakType}
                  </span>
                </div>
              </DetailRow>

              <Separator />

              <DetailRow label="Bank Name" icon={Shield}>
                <span
                  className={cn(!alert.bankName && "text-muted-foreground")}
                >
                  {alert.bankName ?? "Not bank-specific"}
                </span>
              </DetailRow>

              <Separator />

              <DetailRow label="Detected At" icon={Clock}>
                <div>
                  <p className="font-medium">
                    {formatDateTime(alert.detectedAt)}
                  </p>
                  <p className="text-muted-foreground">
                    {formatRelativeTime(alert.detectedAt)}
                  </p>
                </div>
              </DetailRow>

              <Separator />

              <DetailRow
                label="Review Status"
                icon={alert.reviewed ? Eye : EyeOff}
              >
                <div className="flex items-center gap-2">
                  {alert.reviewed ? (
                    <Badge
                      variant="outline"
                      className="gap-1 border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400"
                    >
                      <CheckCircle2 className="size-3" />
                      Reviewed
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="gap-1 border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400"
                    >
                      <EyeOff className="size-3" />
                      Pending Review
                    </Badge>
                  )}
                </div>
                {alert.reviewed && alert.reviewedBy && (
                  <p className="mt-1 text-muted-foreground">
                    by {alert.reviewedBy}
                  </p>
                )}
                {alert.reviewed && alert.reviewedAt && (
                  <p className="text-muted-foreground">
                    {formatDateTime(alert.reviewedAt)}
                  </p>
                )}
              </DetailRow>
            </CardContent>
          </Card>

          {/* Source Info */}
          {source && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Source Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <DetailRow label="Name" icon={Globe}>
                  <Link
                    href={route("/dashboard/sources")}
                    className="font-medium text-primary hover:underline"
                  >
                    {source.name}
                  </Link>
                </DetailRow>

                <Separator />

                <DetailRow label="Category">
                  <div className="flex items-center gap-1.5">
                    <span>{sourceCategory?.icon ?? "🌐"}</span>
                    <span>{sourceCategory?.label ?? source.category}</span>
                  </div>
                </DetailRow>

                <Separator />

                <DetailRow label="Status">
                  <div className="flex items-center gap-2">
                    {sourceStatus && (
                      <span
                        className={cn(
                          "inline-block size-2 rounded-full",
                          sourceStatus.dotClass,
                        )}
                      />
                    )}
                    <span>{sourceStatus?.label ?? source.status}</span>
                  </div>
                </DetailRow>

                <Separator />

                <DetailRow label="URL">
                  <span className="break-all font-mono text-[10px] text-muted-foreground">
                    {source.url}
                  </span>
                </DetailRow>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant={alert.reviewed ? "outline" : "default"}
                size="sm"
                className="w-full gap-1.5"
                disabled={reviewing}
                onClick={handleReview}
              >
                {reviewing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : alert.reviewed ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                {alert.reviewed ? "Mark Unreviewed" : "Mark as Reviewed"}
              </Button>
              <Link href={route("/dashboard/alerts")} className="block">
                <Button variant="outline" size="sm" className="w-full gap-1.5">
                  <ArrowLeft className="size-3.5" />
                  Back to Alerts
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
