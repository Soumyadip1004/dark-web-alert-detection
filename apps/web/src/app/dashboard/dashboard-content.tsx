"use client";

import {
  Card,
  CardContent,
} from "@dark-web-alert-detection/ui/components/card";
import { ShieldAlertIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import { SectionCards } from "@/components/section-cards";
import {
  type DashboardStats,
  fetchStats,
  fetchTimeline,
  type TimelineEntry,
} from "@/lib/api";
import type { authClient } from "@/lib/auth-client";

interface DashboardContentProps {
  session: typeof authClient.$Infer.Session;
}

export function DashboardContent({ session }: DashboardContentProps) {
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

  if (error) {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        <SectionCards stats={null} loading={false} />
        <div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ShieldAlertIcon className="mb-3 size-10 text-muted-foreground" />
              <p className="mb-1 font-medium">{error}</p>
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
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <SectionCards stats={stats} loading={loading} />
      <ChartAreaInteractive data={timeline} loading={loading} />
      <DataTable data={stats?.recentAlerts ?? []} loading={loading} />
    </div>
  );
}
