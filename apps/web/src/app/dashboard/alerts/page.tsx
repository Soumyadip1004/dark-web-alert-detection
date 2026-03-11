"use client";

import { Badge } from "@dark-web-alert-detection/ui/components/badge";
import { Button } from "@dark-web-alert-detection/ui/components/button";
import { Input } from "@dark-web-alert-detection/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dark-web-alert-detection/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dark-web-alert-detection/ui/components/table";
import { cn } from "@dark-web-alert-detection/ui/lib/utils";
import {
  AlertTriangle,
  ArrowUpDownIcon,
  ArrowUpRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2,
  RotateCw,
  Search,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  type Alert,
  type AlertsQuery,
  fetchAlerts,
  formatDateTime,
  formatRelativeTime,
  LEAK_TYPE_CONFIG,
  type LeakType,
  type PaginationInfo,
  RISK_LEVEL_CONFIG,
  type RiskLevel,
  reviewAlert,
} from "@/lib/api";
import { route } from "@/lib/routes";

// ─── Risk Badge (matches overview DataTable) ───────────

function RiskBadge({ level }: { level: RiskLevel }) {
  const config = RISK_LEVEL_CONFIG[level];
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

// ─── Sort Field Type ───────────────────────────────────

type SortField = "detectedAt" | "riskLevel" | "leakType" | "bankName";

// ─── Main Component ────────────────────────────────────

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // ─── Filters ──────────────────────────────────────
  const [query, setQuery] = useState<AlertsQuery>({
    page: 1,
    limit: 15,
    sortBy: "detectedAt",
    sortDir: "desc",
  });
  const [searchInput, setSearchInput] = useState("");

  const loadAlerts = useCallback(async (q: AlertsQuery) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchAlerts(q);
      setAlerts(res.data);
      setPagination(res.pagination);
    } catch (err) {
      console.error("Failed to load alerts:", err);
      setError(err instanceof Error ? err.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts(query);
  }, [query, loadAlerts]);

  // ─── Filter handlers ─────────────────────────────

  function updateFilter(update: Partial<AlertsQuery>) {
    setQuery(prev => ({ ...prev, ...update, page: 1 }));
  }

  function handleSearch() {
    updateFilter({ search: searchInput || undefined });
  }

  function handleSort(field: SortField) {
    setQuery(prev => ({
      ...prev,
      sortBy: field,
      sortDir:
        prev.sortBy === field && prev.sortDir === "desc" ? "asc" : "desc",
      page: 1,
    }));
  }

  function clearFilters() {
    setSearchInput("");
    setQuery({
      page: 1,
      limit: 15,
      sortBy: "detectedAt",
      sortDir: "desc",
    });
  }

  const hasActiveFilters = Boolean(
    query.riskLevel ||
      query.leakType ||
      query.reviewed !== undefined ||
      query.search,
  );

  // ─── Review handler ──────────────────────────────

  async function handleReview(alertId: string, currentReviewed: boolean) {
    try {
      setReviewingId(alertId);
      const res = await reviewAlert(alertId, { reviewed: !currentReviewed });
      setAlerts(prev =>
        prev.map(a => (a.id === alertId ? { ...a, ...res.data } : a)),
      );
    } catch (err) {
      console.error("Failed to review alert:", err);
    } finally {
      setReviewingId(null);
    }
  }

  // ─── Column config ───────────────────────────────

  const columnHeaders: {
    key: string;
    label: string;
    sortField?: SortField;
    className?: string;
  }[] = [
    { key: "riskLevel", label: "Risk", sortField: "riskLevel" },
    { key: "leakType", label: "Type", sortField: "leakType" },
    { key: "bankName", label: "Target", sortField: "bankName" },
    {
      key: "matchedData",
      label: "Matched Data",
      className: "hidden lg:table-cell",
    },
    { key: "source", label: "Source", className: "hidden md:table-cell" },
    { key: "detectedAt", label: "Detected", sortField: "detectedAt" },
    { key: "reviewed", label: "Status" },
    { key: "actions", label: "" },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-semibold text-2xl tracking-tight">
              Threat Alerts
            </h1>
            {pagination && (
              <Badge variant="secondary" className="tabular-nums">
                {pagination.total}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            Browse and manage detected threats from dark web monitoring.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => loadAlerts(query)}
        >
          <RotateCw className="size-3.5" />
          Refresh
        </Button>
      </div>

      {/* ─── Filters + Table ─────────────────────────── */}
      <div className="space-y-4">
        {/* ─── Search & Filter Toolbar ────────────── */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search alerts..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleSearch();
              }}
              className="h-8 pl-8 text-xs"
            />
          </div>

          {/* Filter selects */}
          <div className="flex items-center gap-2">
            {/* Risk Level */}
            <Select
              value={query.riskLevel ?? "_all"}
              onValueChange={val =>
                updateFilter({
                  riskLevel: val === "_all" ? undefined : (val as RiskLevel),
                })
              }
            >
              <SelectTrigger className="h-8 w-36 text-xs" size="sm">
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Levels</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>

            {/* Leak Type */}
            <Select
              value={query.leakType ?? "_all"}
              onValueChange={val =>
                updateFilter({
                  leakType: val === "_all" ? undefined : (val as LeakType),
                })
              }
            >
              <SelectTrigger className="h-8 w-36 text-xs" size="sm">
                <SelectValue placeholder="Leak Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Types</SelectItem>
                <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                <SelectItem value="CREDENTIAL_DUMP">Credentials</SelectItem>
                <SelectItem value="BANK_DATA">Bank Data</SelectItem>
                <SelectItem value="PII">PII</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>

            {/* Review Status */}
            <Select
              value={
                query.reviewed === undefined
                  ? "_all"
                  : query.reviewed
                    ? "true"
                    : "false"
              }
              onValueChange={val =>
                updateFilter({
                  reviewed: val === "_all" ? undefined : val === "true",
                })
              }
            >
              <SelectTrigger className="h-8 w-32 text-xs" size="sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Status</SelectItem>
                <SelectItem value="false">Unreviewed</SelectItem>
                <SelectItem value="true">Reviewed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ─── Table ─────────────────────────────── */}
        <div className="overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {columnHeaders.map(col => (
                  <TableHead
                    key={col.key}
                    className={cn("text-xs", col.className)}
                  >
                    {col.sortField ? (
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => handleSort(col.sortField!)}
                      >
                        {col.label}
                        <ArrowUpDownIcon className="size-3 text-muted-foreground" />
                      </button>
                    ) : (
                      col.label
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {columnHeaders.map(col => (
                      <TableCell
                        key={col.key}
                        className={cn("py-2", col.className)}
                      >
                        <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell
                    colSpan={columnHeaders.length}
                    className="h-24 text-center"
                  >
                    <div className="flex flex-col items-center justify-center py-16">
                      <AlertTriangle className="mb-3 size-8 text-destructive/50" />
                      <p className="mb-1 font-medium text-sm">{error}</p>
                      <p className="mb-4 text-muted-foreground text-xs">
                        Make sure the backend server is running.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadAlerts(query)}
                      >
                        Try again
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : alerts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columnHeaders.length}
                    className="h-24 text-center"
                  >
                    <div className="flex flex-col items-center justify-center py-16">
                      <Shield className="mb-3 size-10 text-muted-foreground/40" />
                      <p className="mb-1 font-medium text-sm">
                        No alerts found
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {hasActiveFilters
                          ? "Try adjusting your filters or search query."
                          : "Alerts will appear here once the crawler detects threats."}
                      </p>
                      {hasActiveFilters && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={clearFilters}
                        >
                          Clear filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                alerts.map(alert => (
                  <TableRow
                    key={alert.id}
                    className={cn(
                      "group cursor-pointer transition-colors hover:bg-muted/50",
                      !alert.reviewed && "bg-muted/20",
                    )}
                  >
                    {/* Risk */}
                    <TableCell className="py-2">
                      <RiskBadge level={alert.riskLevel} />
                    </TableCell>

                    {/* Leak Type */}
                    <TableCell className="py-2">
                      {(() => {
                        const config = LEAK_TYPE_CONFIG[alert.leakType];
                        return (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">
                              {config?.icon ?? "📄"}
                            </span>
                            <span className="truncate text-xs">
                              {config?.label ?? alert.leakType}
                            </span>
                          </div>
                        );
                      })()}
                    </TableCell>

                    {/* Target / Bank */}
                    <TableCell className="py-2">
                      <span className="truncate font-medium text-xs">
                        {alert.bankName ?? "—"}
                      </span>
                    </TableCell>

                    {/* Matched Data */}
                    <TableCell className="hidden py-2 lg:table-cell">
                      <Link
                        href={route(`/dashboard/alerts/${alert.id}`)}
                        className="line-clamp-1 max-w-[200px] truncate text-muted-foreground text-xs hover:text-foreground"
                        title={alert.matchedData}
                      >
                        {alert.matchedData}
                      </Link>
                    </TableCell>

                    {/* Source */}
                    <TableCell className="hidden py-2 md:table-cell">
                      <span className="truncate text-muted-foreground text-xs">
                        {alert.post?.source?.name ?? "—"}
                      </span>
                    </TableCell>

                    {/* Detected */}
                    <TableCell className="py-2">
                      <span
                        className="whitespace-nowrap text-muted-foreground text-xs tabular-nums"
                        title={formatDateTime(alert.detectedAt)}
                      >
                        {formatRelativeTime(alert.detectedAt)}
                      </span>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-2">
                      {alert.reviewed ? (
                        <Badge
                          variant="outline"
                          className="gap-1 border-transparent bg-green-500/10 text-green-600 dark:text-green-400"
                        >
                          <EyeIcon className="size-3" />
                          Reviewed
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 border-transparent bg-orange-500/10 text-orange-600 dark:text-orange-400"
                        >
                          <EyeOffIcon className="size-3" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          title={
                            alert.reviewed
                              ? "Mark as unreviewed"
                              : "Mark as reviewed"
                          }
                          disabled={reviewingId === alert.id}
                          onClick={e => {
                            e.stopPropagation();
                            handleReview(alert.id, alert.reviewed);
                          }}
                        >
                          {reviewingId === alert.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : alert.reviewed ? (
                            <EyeOffIcon className="size-3.5" />
                          ) : (
                            <EyeIcon className="size-3.5" />
                          )}
                        </Button>
                        <Link href={route(`/dashboard/alerts/${alert.id}`)}>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title="View details"
                          >
                            <ArrowUpRightIcon className="size-3.5" />
                            <span className="sr-only">View alert</span>
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* ─── Pagination ────────────────────────── */}
        {!loading && pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>
              Page {pagination.page} of {pagination.totalPages}
              {" · "}
              {pagination.total} alert{pagination.total !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-xs"
                onClick={() =>
                  setQuery(prev => ({
                    ...prev,
                    page: Math.max(1, (prev.page ?? 1) - 1),
                  }))
                }
                disabled={!pagination.hasPrev}
              >
                <ChevronLeftIcon className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon-xs"
                onClick={() =>
                  setQuery(prev => ({
                    ...prev,
                    page: Math.min(pagination.totalPages, (prev.page ?? 1) + 1),
                  }))
                }
                disabled={!pagination.hasNext}
              >
                <ChevronRightIcon className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
