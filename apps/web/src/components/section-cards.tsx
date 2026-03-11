"use client";

import { Badge } from "@dark-web-alert-detection/ui/components/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@dark-web-alert-detection/ui/components/card";
import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";

import type { DashboardStats } from "@/lib/api";

interface SectionCardsProps {
  stats: DashboardStats | null;
  loading?: boolean;
}

export function SectionCards({ stats, loading }: SectionCardsProps) {
  if (loading || !stats) {
    return (
      <div className="grid @5xl/main:grid-cols-4 @xl/main:grid-cols-2 grid-cols-1 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="@container/card animate-pulse">
            <CardHeader>
              <CardDescription>
                <span className="inline-block h-4 w-24 rounded bg-muted" />
              </CardDescription>
              <CardTitle className="font-semibold text-2xl tabular-nums">
                <span className="inline-block h-8 w-16 rounded bg-muted" />
              </CardTitle>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="h-4 w-40 rounded bg-muted" />
              <div className="h-4 w-32 rounded bg-muted" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  const totalAlerts = stats.alerts.total;
  const unreviewed = stats.alerts.unreviewed;
  const activeSources = stats.sources.active;
  const totalSources = stats.sources.total;
  const postsScraped = stats.posts.total;
  const postsLast24h = stats.posts.last24h;
  const alertsLast24h = stats.alerts.last24h;
  const alertsLast7d = stats.alerts.last7d;

  const unreviewedPct =
    totalAlerts > 0 ? Math.round((unreviewed / totalAlerts) * 100) : 0;
  const sourceUtilization =
    totalSources > 0 ? Math.round((activeSources / totalSources) * 100) : 0;

  return (
    <div className="grid @5xl/main:grid-cols-4 @xl/main:grid-cols-2 grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs dark:*:data-[slot=card]:bg-card">
      {/* Total Alerts */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Alerts</CardDescription>
          <CardTitle className="font-semibold @[250px]/card:text-3xl text-2xl tabular-nums">
            {totalAlerts.toLocaleString()}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {alertsLast24h > 0 ? (
                <>
                  <TrendingUpIcon />+{alertsLast24h} today
                </>
              ) : (
                <>
                  <MinusIcon />
                  No new
                </>
              )}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {alertsLast7d} alerts in the last 7 days
            {alertsLast7d > 0 ? (
              <TrendingUpIcon className="size-4" />
            ) : (
              <MinusIcon className="size-4" />
            )}
          </div>
          <div className="text-muted-foreground">
            Across all monitored sources
          </div>
        </CardFooter>
      </Card>

      {/* Unreviewed */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Unreviewed Alerts</CardDescription>
          <CardTitle className="font-semibold @[250px]/card:text-3xl text-2xl tabular-nums">
            {unreviewed.toLocaleString()}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {unreviewedPct > 50 ? (
                <>
                  <TrendingDownIcon />
                  {unreviewedPct}% pending
                </>
              ) : unreviewedPct > 0 ? (
                <>
                  <TrendingUpIcon />
                  {100 - unreviewedPct}% reviewed
                </>
              ) : (
                <>
                  <TrendingUpIcon />
                  All clear
                </>
              )}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {unreviewed > 0 ? "Pending analyst review" : "All alerts reviewed"}
            {unreviewed > 0 ? (
              <TrendingDownIcon className="size-4" />
            ) : (
              <TrendingUpIcon className="size-4" />
            )}
          </div>
          <div className="text-muted-foreground">
            {unreviewed > 0
              ? "Requires immediate attention"
              : "Great job staying on top of threats"}
          </div>
        </CardFooter>
      </Card>

      {/* Active Sources */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Active Sources</CardDescription>
          <CardTitle className="font-semibold @[250px]/card:text-3xl text-2xl tabular-nums">
            {activeSources}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {sourceUtilization >= 80 ? (
                <>
                  <TrendingUpIcon />
                  {sourceUtilization}% active
                </>
              ) : (
                <>
                  <TrendingDownIcon />
                  {sourceUtilization}% active
                </>
              )}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {totalSources} total sources monitored
            <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Dark web forums, marketplaces & paste sites
          </div>
        </CardFooter>
      </Card>

      {/* Posts Scraped */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Posts Scraped</CardDescription>
          <CardTitle className="font-semibold @[250px]/card:text-3xl text-2xl tabular-nums">
            {postsScraped.toLocaleString()}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {postsLast24h > 0 ? (
                <>
                  <TrendingUpIcon />+{postsLast24h} today
                </>
              ) : (
                <>
                  <MinusIcon />
                  No new
                </>
              )}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {postsLast24h > 0
              ? `${postsLast24h} new posts collected today`
              : "No new posts today"}
            {postsLast24h > 0 ? (
              <TrendingUpIcon className="size-4" />
            ) : (
              <MinusIcon className="size-4" />
            )}
          </div>
          <div className="text-muted-foreground">
            Continuously crawled and analyzed
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
