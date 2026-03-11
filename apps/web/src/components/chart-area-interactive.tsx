"use client";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@dark-web-alert-detection/ui/components/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@dark-web-alert-detection/ui/components/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dark-web-alert-detection/ui/components/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@dark-web-alert-detection/ui/components/toggle-group";
import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";

import type { TimelineEntry } from "@/lib/api";

const chartConfig = {
  alerts: {
    label: "Alerts",
  },
  CRITICAL: {
    label: "Critical",
    color: "var(--color-red-500)",
  },
  HIGH: {
    label: "High",
    color: "var(--color-orange-500)",
  },
  MEDIUM: {
    label: "Medium",
    color: "var(--color-yellow-500)",
  },
  LOW: {
    label: "Low",
    color: "var(--color-green-500)",
  },
} satisfies ChartConfig;

interface ChartAreaInteractiveProps {
  data: TimelineEntry[];
  loading?: boolean;
}

export function ChartAreaInteractive({
  data,
  loading,
}: ChartAreaInteractiveProps) {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("30d");

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d");
    }
  }, [isMobile]);

  const filteredData = React.useMemo(() => {
    if (!data || data.length === 0) return [];

    const now = new Date();
    let daysToSubtract = 30;
    if (timeRange === "14d") {
      daysToSubtract = 14;
    } else if (timeRange === "7d") {
      daysToSubtract = 7;
    }

    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysToSubtract);

    return data.filter(item => {
      const date = new Date(item.date);
      return date >= startDate;
    });
  }, [data, timeRange]);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Alert Timeline</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">
            Alerts detected over time by risk level
          </span>
          <span className="@[540px]/card:hidden">Alert history</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            multiple={false}
            value={timeRange ? [timeRange] : []}
            onValueChange={value => {
              setTimeRange(value[0] ?? "30d");
            }}
            variant="outline"
            className="@[767px]/card:flex hidden *:data-[slot=toggle-group-item]:px-4!"
          >
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="14d">Last 14 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select
            value={timeRange}
            onValueChange={value => {
              if (value !== null) {
                setTimeRange(value);
              }
            }}
          >
            <SelectTrigger
              className="flex @[767px]/card:hidden w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 30 days" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="14d" className="rounded-lg">
                Last 14 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {loading ? (
          <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">
            Loading timeline data...
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">
            No timeline data available
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="fillCritical" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-red-500)"
                    stopOpacity={0.9}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-red-500)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id="fillHigh" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-orange-500)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-orange-500)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id="fillMedium" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-yellow-500)"
                    stopOpacity={0.7}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-yellow-500)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
                <linearGradient id="fillLow" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-green-500)"
                    stopOpacity={0.6}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-green-500)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value: string) => {
                  const date = new Date(value);
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value: string) => {
                      return new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });
                    }}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="LOW"
                type="natural"
                fill="url(#fillLow)"
                stroke="var(--color-green-500)"
                stackId="alerts"
              />
              <Area
                dataKey="MEDIUM"
                type="natural"
                fill="url(#fillMedium)"
                stroke="var(--color-yellow-500)"
                stackId="alerts"
              />
              <Area
                dataKey="HIGH"
                type="natural"
                fill="url(#fillHigh)"
                stroke="var(--color-orange-500)"
                stackId="alerts"
              />
              <Area
                dataKey="CRITICAL"
                type="natural"
                fill="url(#fillCritical)"
                stroke="var(--color-red-500)"
                stackId="alerts"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
