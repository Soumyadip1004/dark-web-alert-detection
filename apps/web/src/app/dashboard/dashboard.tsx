"use client";

import { Badge } from "@dark-web-alert-detection/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@dark-web-alert-detection/ui/components/card";
import { Skeleton } from "@dark-web-alert-detection/ui/components/skeleton";
import { cn } from "@dark-web-alert-detection/ui/lib/utils";
import {
  AlertTriangle,
  ArrowUpRight,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Shield,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  type DashboardStats,
  fetchStats,
  fetchTimeline,
  formatRelativeTime,
  LEAK_TYPE_CONFIG,
  RISK_LEVEL_CONFIG,
  type TimelineEntry,
} from "@/lib/api";
import type { authClient } from "@/lib/auth-client";
import { route } from "@/lib/routes";

// ─── Stat Card ─────────────────────────────────────────

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: string; positive?: boolean };
  className?: string;
}) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardDescription className="font-medium text-xs">
          {title}
        </CardDescription>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="font-bold text-2xl tabular-nums">{value}</div>
        {description && (
          <p className="mt-1 text-muted-foreground text-xs">{description}</p>
        )}
        {trend && (
          <div className="mt-1 flex items-center gap-1 text-xs">
            <TrendingUp
              className={cn(
                "size-3",
                trend.positive ? "text-green-500" : "text-red-500",
              )}
            />
            <span
              className={cn(
                trend.positive
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400",
              )}
            >
              {trend.value}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Risk Level Badge ──────────────────────────────────

function RiskBadge({ level }: { level: string }) {
  const config = RISK_LEVEL_CONFIG[level as keyof typeof RISK_LEVEL_CONFIG];
  if (!config) return <Badge variant="outline">{level}</Badge>;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-transparent font-medium",
        config.bgClass,
        config.textClass,
      )}
    >
      <span
        className={cn(
          "inline-block size-1.5 rounded-full",
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

// ─── Mini Bar Chart ────────────────────────────────────

function MiniTimeline({ data }: { data: TimelineEntry[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-muted-foreground text-xs">
        No timeline data available
      </div>
    );
  }

  const maxTotal = Math.max(...data.map(d => d.total), 1);
  // Show last 14 days
  const recent = data.slice(-14);

  return (
    <div className="flex h-24 items-end gap-[3px]">
      {recent.map(entry => {
        const height = (entry.total / maxTotal) * 100;
        const hasCritical = entry.CRITICAL > 0;
        const hasHigh = entry.HIGH > 0;

        return (
          <div
            key={entry.date}
            className="group relative flex-1"
            title={`${entry.date}: ${entry.total} alerts`}
          >
            <div
              className={cn(
                "w-full rounded-t-sm transition-colors",
                hasCritical
                  ? "bg-red-500/80 dark:bg-red-500/60"
                  : hasHigh
                    ? "bg-orange-500/70 dark:bg-orange-500/50"
                    : entry.total > 0
                      ? "bg-primary/40 dark:bg-primary/30"
                      : "bg-muted",
              )}
              style={{ height: `${Math.max(height, 4)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Risk Distribution Bar ─────────────────────────────

function RiskDistribution({
  byRiskLevel,
}: {
  byRiskLevel: Record<string, number>;
}) {
  const total =
    (byRiskLevel.CRITICAL ?? 0) +
    (byRiskLevel.HIGH ?? 0) +
    (byRiskLevel.MEDIUM ?? 0) +
    (byRiskLevel.LOW ?? 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center py-4 text-muted-foreground text-xs">
        No alerts to display
      </div>
    );
  }

  const segments = [
    { key: "CRITICAL", color: "bg-red-500", count: byRiskLevel.CRITICAL ?? 0 },
    { key: "HIGH", color: "bg-orange-500", count: byRiskLevel.HIGH ?? 0 },
    { key: "MEDIUM", color: "bg-yellow-500", count: byRiskLevel.MEDIUM ?? 0 },
    { key: "LOW", color: "bg-green-500", count: byRiskLevel.LOW ?? 0 },
  ];

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        {segments.map(seg => {
          const pct = (seg.count / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={seg.key}
              className={cn("transition-all", seg.color)}
              style={{ width: `${pct}%` }}
              title={`${seg.key}: ${seg.count}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2">
        {segments.map(seg => (
          <div key={seg.key} className="flex items-center gap-2 text-xs">
            <span className={cn("size-2 rounded-full", seg.color)} />
            <span className="text-muted-foreground">
              {
                RISK_LEVEL_CONFIG[seg.key as keyof typeof RISK_LEVEL_CONFIG]
                  ?.label
              }
            </span>
            <span className="ml-auto font-medium tabular-nums">
              {seg.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Loading State ─────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="mt-2 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content area */}
      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────

export default function DashboardOverview({
  session,
}: {
  session: typeof authClient.$Infer.Session;
}) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsRes, timelineRes] = await Promise.all([
        fetchStats(),
        fetchTimeline(30),
      ]);
      setStats(statsRes.data);
      setTimeline(timelineRes.data);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load dashboard data",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Welcome back, {session.user.name}
          </p>
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Welcome back, {session.user.name}
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShieldAlert className="mb-3 size-10 text-muted-foreground" />
            <p className="mb-1 font-medium">{error ?? "Unable to load data"}</p>
            <p className="mb-4 text-muted-foreground text-sm">
              Make sure the backend server is running on port 3000.
            </p>
            <button
              type="button"
              onClick={loadData}
              className="text-primary text-sm underline-offset-4 hover:underline"
            >
              Try again
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Welcome back, {session.user.name}. Here&apos;s your threat overview.
          </p>
        </div>
        <Link
          href={route("/dashboard/alerts")}
          className="flex items-center gap-1 text-primary text-xs hover:underline"
        >
          View all alerts
          <ArrowUpRight className="size-3" />
        </Link>
      </div>

      {/* ─── Stat Cards ─────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Alerts"
          value={stats.alerts.total}
          description={`${stats.alerts.last24h} in the last 24h`}
          icon={AlertTriangle}
          trend={
            stats.alerts.last24h > 0
              ? { value: `+${stats.alerts.last24h} today`, positive: false }
              : undefined
          }
        />
        <StatCard
          title="Unreviewed"
          value={stats.alerts.unreviewed}
          description="Pending analyst review"
          icon={EyeOff}
          className={
            stats.alerts.unreviewed > 0
              ? "ring-1 ring-orange-500/20"
              : undefined
          }
        />
        <StatCard
          title="Active Sources"
          value={stats.sources.active}
          description={`${stats.sources.total} total monitored`}
          icon={Globe}
        />
        <StatCard
          title="Posts Scraped"
          value={stats.posts.total}
          description={`${stats.posts.last24h} in the last 24h`}
          icon={FileText}
        />
      </div>

      {/* ─── Row: Timeline + Risk Distribution ──────── */}
      <div className="grid gap-4 lg:grid-cols-7">
        {/* Alert Timeline */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Alert Timeline</CardTitle>
                <CardDescription>Alerts over the last 14 days</CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px]">
                Last 30 days
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <MiniTimeline data={timeline} />
            <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                {timeline.length > 14
                  ? timeline[timeline.length - 14]?.date
                  : timeline[0]?.date}
              </span>
              <span>{timeline[timeline.length - 1]?.date}</span>
            </div>
          </CardContent>
        </Card>

        {/* Risk Distribution */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Risk Distribution</CardTitle>
            <CardDescription>Breakdown of alerts by risk level</CardDescription>
          </CardHeader>
          <CardContent>
            <RiskDistribution byRiskLevel={stats.alerts.byRiskLevel} />
          </CardContent>
        </Card>
      </div>

      {/* ─── Row: Recent Alerts + Top Banks ─────────── */}
      <div className="grid gap-4 lg:grid-cols-7">
        {/* Recent Alerts */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>Latest detected threats</CardDescription>
              </div>
              <Link
                href={route("/dashboard/alerts")}
                className="flex items-center gap-1 text-primary text-xs hover:underline"
              >
                View all
                <ArrowUpRight className="size-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {stats.recentAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Shield className="mb-2 size-8 text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm">
                  No alerts detected yet
                </p>
                <p className="text-muted-foreground/80 text-xs">
                  Alerts will appear here once the crawler finds threats.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recentAlerts.map(alert => (
                  <Link
                    key={alert.id}
                    href={route(`/dashboard/alerts/${alert.id}`)}
                    className="group flex items-start gap-3 rounded-lg border border-transparent p-2.5 transition-colors hover:border-border hover:bg-muted/50"
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-sm",
                        RISK_LEVEL_CONFIG[alert.riskLevel]?.bgClass,
                      )}
                    >
                      {LEAK_TYPE_CONFIG[alert.leakType]?.icon ?? "📄"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-xs">
                          {alert.bankName ??
                            LEAK_TYPE_CONFIG[alert.leakType]?.label ??
                            alert.leakType}
                        </span>
                        <RiskBadge level={alert.riskLevel} />
                        {alert.reviewed && (
                          <Eye className="size-3 text-muted-foreground" />
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-muted-foreground text-xs">
                        {alert.matchedData}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{formatRelativeTime(alert.detectedAt)}</span>
                        {alert.post?.source && (
                          <>
                            <span>·</span>
                            <span>{alert.post.source.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Targeted Banks & Leak Types */}
        <div className="flex flex-col gap-4 lg:col-span-3">
          {/* Top Banks */}
          <Card>
            <CardHeader>
              <CardTitle>Top Targeted Banks</CardTitle>
              <CardDescription>Most mentioned institutions</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.topBanks.length === 0 ? (
                <p className="py-4 text-center text-muted-foreground text-xs">
                  No bank-specific alerts yet
                </p>
              ) : (
                <div className="space-y-2.5">
                  {stats.topBanks.slice(0, 5).map((bank, index) => {
                    const maxCount = stats.topBanks[0]?.count ?? 1;
                    const pct = (bank.count / maxCount) * 100;
                    return (
                      <div key={bank.bankName} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2 font-medium">
                            <span className="text-[10px] text-muted-foreground">
                              #{index + 1}
                            </span>
                            {bank.bankName}
                          </span>
                          <span className="text-muted-foreground tabular-nums">
                            {bank.count}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/60 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leak Types */}
          <Card>
            <CardHeader>
              <CardTitle>Leak Types</CardTitle>
              <CardDescription>Distribution by category</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(stats.alerts.byLeakType).length === 0 ? (
                <p className="py-4 text-center text-muted-foreground text-xs">
                  No leak data available
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(stats.alerts.byLeakType).map(
                    ([type, count]) => {
                      const config =
                        LEAK_TYPE_CONFIG[type as keyof typeof LEAK_TYPE_CONFIG];
                      return (
                        <div
                          key={type}
                          className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5"
                        >
                          <span className="text-sm">
                            {config?.icon ?? "📄"}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-xs">
                              {config?.label ?? type}
                            </p>
                            <p className="text-[10px] text-muted-foreground tabular-nums">
                              {count} alerts
                            </p>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
