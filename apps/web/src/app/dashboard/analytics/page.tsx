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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dark-web-alert-detection/ui/components/select";
import { Skeleton } from "@dark-web-alert-detection/ui/components/skeleton";
import { cn } from "@dark-web-alert-detection/ui/lib/utils";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Globe,
  PieChart,
  RotateCw,
  Shield,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  type DashboardStats,
  fetchStats,
  fetchTimeline,
  LEAK_TYPE_CONFIG,
  RISK_LEVEL_CONFIG,
  type TimelineEntry,
} from "@/lib/api";

// ─── Timeline Bar Chart ────────────────────────────────

function TimelineChart({
  data,
  height = 200,
}: {
  data: TimelineEntry[];
  height?: number;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-sm"
        style={{ height }}
      >
        <div className="text-center">
          <BarChart3 className="mx-auto mb-2 size-8 opacity-30" />
          <p>No timeline data available</p>
        </div>
      </div>
    );
  }

  const maxTotal = Math.max(...data.map(d => d.total), 1);

  return (
    <div className="space-y-2">
      {/* Chart */}
      <div className="flex items-end gap-[2px]" style={{ height }}>
        {data.map((entry, i) => {
          const totalHeight = (entry.total / maxTotal) * 100;
          const criticalPct =
            entry.total > 0 ? (entry.CRITICAL / entry.total) * 100 : 0;
          const highPct =
            entry.total > 0 ? (entry.HIGH / entry.total) * 100 : 0;
          const mediumPct =
            entry.total > 0 ? (entry.MEDIUM / entry.total) * 100 : 0;
          const isHovered = hoveredIndex === i;

          return (
            <div
              key={entry.date}
              role="img"
              aria-label={`${entry.date}: ${entry.total} alerts`}
              className="group relative flex flex-1 flex-col justify-end"
              style={{ height: "100%" }}
              onPointerEnter={() => setHoveredIndex(i)}
              onPointerLeave={() => setHoveredIndex(null)}
            >
              {/* Tooltip */}
              {isHovered && entry.total > 0 && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2">
                  <div className="whitespace-nowrap rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                    <p className="mb-1 font-medium">{entry.date}</p>
                    <p className="text-muted-foreground">
                      Total:{" "}
                      <span className="font-medium text-foreground">
                        {entry.total}
                      </span>
                    </p>
                    {entry.CRITICAL > 0 && (
                      <p className="text-red-500">Critical: {entry.CRITICAL}</p>
                    )}
                    {entry.HIGH > 0 && (
                      <p className="text-orange-500">High: {entry.HIGH}</p>
                    )}
                    {entry.MEDIUM > 0 && (
                      <p className="text-yellow-500">Medium: {entry.MEDIUM}</p>
                    )}
                    {entry.LOW > 0 && (
                      <p className="text-green-500">Low: {entry.LOW}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Stacked bar */}
              <div
                className={cn(
                  "w-full overflow-hidden rounded-t-sm transition-all",
                  isHovered ? "opacity-100" : "opacity-80",
                )}
                style={{
                  height: `${Math.max(totalHeight, entry.total > 0 ? 3 : 1)}%`,
                }}
              >
                {entry.total > 0 ? (
                  <div className="flex h-full flex-col-reverse">
                    {/* LOW (bottom) */}
                    <div
                      className="w-full bg-green-500/70 dark:bg-green-500/50"
                      style={{
                        height: `${100 - criticalPct - highPct - mediumPct}%`,
                      }}
                    />
                    {/* MEDIUM */}
                    {mediumPct > 0 && (
                      <div
                        className="w-full bg-yellow-500/70 dark:bg-yellow-500/50"
                        style={{ height: `${mediumPct}%` }}
                      />
                    )}
                    {/* HIGH */}
                    {highPct > 0 && (
                      <div
                        className="w-full bg-orange-500/70 dark:bg-orange-500/50"
                        style={{ height: `${highPct}%` }}
                      />
                    )}
                    {/* CRITICAL (top) */}
                    {criticalPct > 0 && (
                      <div
                        className="w-full bg-red-500/80 dark:bg-red-500/60"
                        style={{ height: `${criticalPct}%` }}
                      />
                    )}
                  </div>
                ) : (
                  <div className="h-full w-full bg-muted/50" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{data[0]?.date}</span>
        {data.length > 10 && (
          <span>{data[Math.floor(data.length / 2)]?.date}</span>
        )}
        <span>{data[data.length - 1]?.date}</span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs">
        {(
          [
            { key: "CRITICAL", color: "bg-red-500" },
            { key: "HIGH", color: "bg-orange-500" },
            { key: "MEDIUM", color: "bg-yellow-500" },
            { key: "LOW", color: "bg-green-500" },
          ] as const
        ).map(item => (
          <div key={item.key} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", item.color)} />
            <span className="text-muted-foreground">
              {RISK_LEVEL_CONFIG[item.key].label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Donut-style Ring Chart ────────────────────────────

function RingChart({
  segments,
  size = 160,
  strokeWidth = 20,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  size?: number;
  strokeWidth?: number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-sm"
        style={{ width: size, height: size }}
      >
        <div className="text-center">
          <PieChart className="mx-auto mb-1 size-6 opacity-30" />
          <p className="text-xs">No data</p>
        </div>
      </div>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {segments.map(seg => {
            if (seg.value === 0) return null;
            const pct = seg.value / total;
            const dashLength = circumference * pct;
            const dashOffset = circumference * accumulated;
            accumulated += pct;

            return (
              <circle
                key={seg.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={-dashOffset}
                className="transition-all duration-500"
              />
            );
          })}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-bold text-2xl tabular-nums">{total}</span>
          <span className="text-[10px] text-muted-foreground">Total</span>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        {segments.map(seg => (
          <div key={seg.label} className="flex items-center gap-2 text-xs">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-muted-foreground">{seg.label}</span>
            <span className="ml-auto font-medium tabular-nums">
              {seg.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Horizontal Bar Chart ──────────────────────────────

function HorizontalBarChart({
  items,
  maxItems = 10,
}: {
  items: Array<{ label: string; value: number; icon?: string }>;
  maxItems?: number;
}) {
  const displayed = items.slice(0, maxItems);
  const maxValue = Math.max(...displayed.map(d => d.value), 1);

  if (displayed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <BarChart3 className="mb-2 size-8 text-muted-foreground/30" />
        <p className="text-muted-foreground text-xs">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {displayed.map((item, index) => {
        const pct = (item.value / maxValue) * 100;
        return (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <span className="w-4 text-center text-[10px] text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                {item.icon && <span className="text-sm">{item.icon}</span>}
                <span className="font-medium">{item.label}</span>
              </span>
              <span className="text-muted-foreground tabular-nums">
                {item.value}
              </span>
            </div>
            <div className="ml-6 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/60 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Trend Metric Card ─────────────────────────────────

function TrendCard({
  title,
  value,
  previousValue,
  suffix,
  icon: Icon,
}: {
  title: string;
  value: number;
  previousValue: number;
  suffix?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const diff = value - previousValue;
  const pctChange =
    previousValue > 0 ? ((diff / previousValue) * 100).toFixed(0) : "—";
  const isUp = diff > 0;
  const isNeutral = diff === 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardDescription className="font-medium text-xs">
          {title}
        </CardDescription>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="font-bold text-2xl tabular-nums">
          {value}
          {suffix && (
            <span className="ml-1 font-normal text-muted-foreground text-sm">
              {suffix}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1 text-xs">
          {isNeutral ? (
            <span className="text-muted-foreground">No change</span>
          ) : (
            <>
              {isUp ? (
                <TrendingUp className="size-3 text-red-500" />
              ) : (
                <TrendingDown className="size-3 text-green-500" />
              )}
              <span
                className={cn(
                  isUp
                    ? "text-red-600 dark:text-red-400"
                    : "text-green-600 dark:text-green-400",
                )}
              >
                {isUp ? "+" : ""}
                {diff} ({pctChange}%)
              </span>
              <span className="text-muted-foreground">vs previous period</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Skeleton ──────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
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
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="flex justify-center">
            <Skeleton className="h-[180px] w-[180px] rounded-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────

export default function AnalyticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timelineDays, setTimelineDays] = useState<number>(30);

  const loadData = useCallback(async (days: number) => {
    try {
      setLoading(true);
      setError(null);
      const [statsRes, timelineRes] = await Promise.all([
        fetchStats(),
        fetchTimeline(days),
      ]);
      setStats(statsRes.data);
      setTimeline(timelineRes.data);
    } catch (err) {
      console.error("Failed to load analytics:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load analytics data",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(timelineDays);
  }, [timelineDays, loadData]);

  // ─── Computed values ──────────────────────────────

  const timelineSummary = useMemo(() => {
    if (timeline.length === 0) return null;

    const midpoint = Math.floor(timeline.length / 2);
    const firstHalf = timeline.slice(0, midpoint);
    const secondHalf = timeline.slice(midpoint);

    const firstTotal = firstHalf.reduce((s, e) => s + e.total, 0);
    const secondTotal = secondHalf.reduce((s, e) => s + e.total, 0);

    const firstCritical = firstHalf.reduce((s, e) => s + e.CRITICAL, 0);
    const secondCritical = secondHalf.reduce((s, e) => s + e.CRITICAL, 0);

    const firstHigh = firstHalf.reduce((s, e) => s + e.HIGH, 0);
    const secondHigh = secondHalf.reduce((s, e) => s + e.HIGH, 0);

    const totalAlerts = timeline.reduce((s, e) => s + e.total, 0);
    const peakDay = timeline.reduce(
      (peak, entry) => (entry.total > peak.total ? entry : peak),
      timeline[0]!,
    );

    return {
      firstTotal,
      secondTotal,
      firstCritical,
      secondCritical,
      firstHigh,
      secondHigh,
      totalAlerts,
      peakDay,
    };
  }, [timeline]);

  const riskSegments = useMemo(() => {
    if (!stats) return [];
    return [
      {
        label: "Critical",
        value: stats.alerts.byRiskLevel.CRITICAL ?? 0,
        color: RISK_LEVEL_CONFIG.CRITICAL.color,
      },
      {
        label: "High",
        value: stats.alerts.byRiskLevel.HIGH ?? 0,
        color: RISK_LEVEL_CONFIG.HIGH.color,
      },
      {
        label: "Medium",
        value: stats.alerts.byRiskLevel.MEDIUM ?? 0,
        color: RISK_LEVEL_CONFIG.MEDIUM.color,
      },
      {
        label: "Low",
        value: stats.alerts.byRiskLevel.LOW ?? 0,
        color: RISK_LEVEL_CONFIG.LOW.color,
      },
    ];
  }, [stats]);

  const leakTypeSegments = useMemo(() => {
    if (!stats) return [];
    const colors: Record<string, string> = {
      CREDIT_CARD: "#ef4444",
      CREDENTIAL_DUMP: "#f97316",
      BANK_DATA: "#eab308",
      PII: "#3b82f6",
      OTHER: "#8b5cf6",
    };
    return Object.entries(stats.alerts.byLeakType).map(([type, count]) => ({
      label:
        LEAK_TYPE_CONFIG[type as keyof typeof LEAK_TYPE_CONFIG]?.label ?? type,
      value: count,
      color: colors[type] ?? "#6b7280",
    }));
  }, [stats]);

  const bankItems = useMemo(() => {
    if (!stats) return [];
    return stats.topBanks.map(b => ({
      label: b.bankName,
      value: b.count,
      icon: "🏦",
    }));
  }, [stats]);

  const leakTypeItems = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.alerts.byLeakType).map(([type, count]) => {
      const config = LEAK_TYPE_CONFIG[type as keyof typeof LEAK_TYPE_CONFIG];
      return {
        label: config?.label ?? type,
        value: count,
        icon: config?.icon ?? "📄",
      };
    });
  }, [stats]);

  // ─── Loading state ────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Threat intelligence insights and trend analysis.
          </p>
        </div>
        <AnalyticsSkeleton />
      </div>
    );
  }

  // ─── Error state ──────────────────────────────────

  if (error || !stats) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Threat intelligence insights and trend analysis.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShieldAlert className="mb-3 size-10 text-muted-foreground" />
            <p className="mb-1 font-medium">
              {error ?? "Unable to load analytics"}
            </p>
            <p className="mb-4 text-muted-foreground text-sm">
              Make sure the backend server is running on port 3000.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(timelineDays)}
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Threat intelligence insights and trend analysis.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => loadData(timelineDays)}
        >
          <RotateCw className="size-3.5" />
          Refresh
        </Button>
      </div>

      {/* ─── Trend Cards ─────────────────────────────── */}
      {timelineSummary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TrendCard
            title="Total Alerts (period)"
            value={timelineSummary.secondTotal}
            previousValue={timelineSummary.firstTotal}
            icon={AlertTriangle}
          />
          <TrendCard
            title="Critical Alerts"
            value={timelineSummary.secondCritical}
            previousValue={timelineSummary.firstCritical}
            icon={ShieldAlert}
          />
          <TrendCard
            title="High Alerts"
            value={timelineSummary.secondHigh}
            previousValue={timelineSummary.firstHigh}
            icon={Shield}
          />
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="font-medium text-xs">
                Peak Day
              </CardDescription>
              <Activity className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl tabular-nums">
                {timelineSummary.peakDay.total}
                <span className="ml-1 font-normal text-muted-foreground text-sm">
                  alerts
                </span>
              </div>
              <p className="mt-1 text-muted-foreground text-xs">
                {timelineSummary.peakDay.date}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Timeline Chart ──────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Alert Timeline</CardTitle>
              <CardDescription>
                Daily alert volume broken down by risk level
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={String(timelineDays)}
                onValueChange={val => setTimelineDays(Number(val))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="14">Last 14 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="60">Last 60 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TimelineChart data={timeline} height={220} />
        </CardContent>
      </Card>

      {/* ─── Row: Risk Distribution + Leak Types ─────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Risk Level Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Level Distribution</CardTitle>
            <CardDescription>
              Breakdown of all alerts by severity
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-4">
            <RingChart segments={riskSegments} size={180} strokeWidth={24} />
          </CardContent>
        </Card>

        {/* Leak Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Leak Type Distribution</CardTitle>
            <CardDescription>Alert categories by data type</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-4">
            <RingChart
              segments={leakTypeSegments}
              size={180}
              strokeWidth={24}
            />
          </CardContent>
        </Card>
      </div>

      {/* ─── Row: Top Banks + Leak Type Breakdown ────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Targeted Banks */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Top Targeted Banks</CardTitle>
                <CardDescription>
                  Most frequently mentioned institutions
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {bankItems.length} banks
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart items={bankItems} maxItems={10} />
          </CardContent>
        </Card>

        {/* Leak Type Breakdown */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Leak Type Breakdown</CardTitle>
                <CardDescription>
                  Alerts by detected data category
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {leakTypeItems.length} types
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart items={leakTypeItems} maxItems={10} />
          </CardContent>
        </Card>
      </div>

      {/* ─── Summary Statistics ───────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Summary Statistics</CardTitle>
          <CardDescription>
            Key metrics across the monitoring platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <AlertTriangle className="mx-auto mb-2 size-5 text-muted-foreground" />
              <p className="font-bold text-xl tabular-nums">
                {stats.alerts.total}
              </p>
              <p className="text-muted-foreground text-xs">Total Alerts</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <Globe className="mx-auto mb-2 size-5 text-muted-foreground" />
              <p className="font-bold text-xl tabular-nums">
                {stats.sources.active}
                <span className="font-normal text-muted-foreground text-sm">
                  {" "}
                  / {stats.sources.total}
                </span>
              </p>
              <p className="text-muted-foreground text-xs">Active Sources</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <BarChart3 className="mx-auto mb-2 size-5 text-muted-foreground" />
              <p className="font-bold text-xl tabular-nums">
                {stats.posts.total}
              </p>
              <p className="text-muted-foreground text-xs">Posts Scraped</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <Shield className="mx-auto mb-2 size-5 text-muted-foreground" />
              <p className="font-bold text-xl tabular-nums">
                {stats.alerts.unreviewed}
              </p>
              <p className="text-muted-foreground text-xs">Pending Review</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
