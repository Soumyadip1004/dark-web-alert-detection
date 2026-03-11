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
import { Input } from "@dark-web-alert-detection/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dark-web-alert-detection/ui/components/select";
import { Skeleton } from "@dark-web-alert-detection/ui/components/skeleton";
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
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  RotateCw,
  Search,
  Shield,
  X,
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

// ─── Risk Level Badge ──────────────────────────────────

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

// ─── Leak Type Badge ───────────────────────────────────

function LeakTypeBadge({ type }: { type: LeakType }) {
  const config = LEAK_TYPE_CONFIG[type];
  if (!config) return <Badge variant="secondary">{type}</Badge>;

  return (
    <Badge variant="secondary" className="gap-1 font-normal">
      <span className="text-xs">{config.icon}</span>
      {config.label}
    </Badge>
  );
}

// ─── Sort Header ───────────────────────────────────────

type SortField = "detectedAt" | "riskLevel" | "leakType" | "bankName";

function SortableHeader({
  label,
  field,
  currentSort,
  currentDir,
  onSort,
}: {
  label: string;
  field: SortField;
  currentSort?: SortField;
  currentDir?: "asc" | "desc";
  onSort: (field: SortField) => void;
}) {
  const isActive = currentSort === field;

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-foreground"
    >
      {label}
      {isActive ? (
        currentDir === "asc" ? (
          <ArrowUp className="size-3" />
        ) : (
          <ArrowDown className="size-3" />
        )
      ) : (
        <ArrowUpDown className="size-3 opacity-40" />
      )}
    </button>
  );
}

// ─── Skeleton Loader ───────────────────────────────────

function AlertsTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-2 py-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-32 flex-1" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-8" />
        </div>
      ))}
    </div>
  );
}

// ─── Pagination ────────────────────────────────────────

function Pagination({
  pagination,
  onPageChange,
}: {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
}) {
  const { page, totalPages, total, limit, hasPrev, hasNext } = pagination;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-muted-foreground text-xs">
        Showing <span className="font-medium tabular-nums">{start}</span>–
        <span className="font-medium tabular-nums">{end}</span> of{" "}
        <span className="font-medium tabular-nums">{total}</span> alerts
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-xs"
          disabled={!hasPrev}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        {/* Page numbers */}
        {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
          let pageNum: number;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (page <= 3) {
            pageNum = i + 1;
          } else if (page >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = page - 2 + i;
          }
          return (
            <Button
              key={pageNum}
              variant={pageNum === page ? "default" : "outline"}
              size="icon-xs"
              onClick={() => onPageChange(pageNum)}
              className="tabular-nums"
            >
              {pageNum}
            </Button>
          );
        })}
        <Button
          variant="outline"
          size="icon-xs"
          disabled={!hasNext}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

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

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Alerts</h1>
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

      {/* ─── Filters ─────────────────────────────────── */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Search */}
            <div className="flex min-w-[200px] flex-1 items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search alerts..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") handleSearch();
                  }}
                  className="pl-8"
                />
              </div>
              <Button variant="outline" size="default" onClick={handleSearch}>
                Search
              </Button>
            </div>

            {/* Risk Level */}
            <Select
              value={query.riskLevel ?? "_all"}
              onValueChange={val =>
                updateFilter({
                  riskLevel: val === "_all" ? undefined : (val as RiskLevel),
                })
              }
            >
              <SelectTrigger className="w-[140px]">
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
              <SelectTrigger className="w-[160px]">
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
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Status</SelectItem>
                <SelectItem value="false">Unreviewed</SelectItem>
                <SelectItem value="true">Reviewed</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-1 text-muted-foreground"
              >
                <X className="size-3.5" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Alerts Table ────────────────────────────── */}
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Alert Results</CardTitle>
              {pagination && (
                <CardDescription>
                  {pagination.total} alert{pagination.total !== 1 ? "s" : ""}{" "}
                  found
                </CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <AlertsTableSkeleton />
          ) : error ? (
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
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Shield className="mb-3 size-10 text-muted-foreground/40" />
              <p className="mb-1 font-medium text-sm">No alerts found</p>
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
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortableHeader
                        label="Risk"
                        field="riskLevel"
                        currentSort={query.sortBy}
                        currentDir={query.sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableHeader
                        label="Type"
                        field="leakType"
                        currentSort={query.sortBy}
                        currentDir={query.sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableHeader
                        label="Bank"
                        field="bankName"
                        currentSort={query.sortBy}
                        currentDir={query.sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Matched Data
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      Source
                    </TableHead>
                    <TableHead>
                      <SortableHeader
                        label="Detected"
                        field="detectedAt"
                        currentSort={query.sortBy}
                        currentDir={query.sortDir}
                        onSort={handleSort}
                      />
                    </TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map(alert => (
                    <TableRow
                      key={alert.id}
                      className={cn(
                        "group cursor-pointer transition-colors",
                        !alert.reviewed && "bg-muted/20",
                      )}
                    >
                      <TableCell>
                        <RiskBadge level={alert.riskLevel} />
                      </TableCell>
                      <TableCell>
                        <LeakTypeBadge type={alert.leakType} />
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-xs">
                          {alert.bankName ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="hidden max-w-[250px] lg:table-cell">
                        <Link
                          href={route(`/dashboard/alerts/${alert.id}`)}
                          className="line-clamp-2 text-muted-foreground text-xs hover:text-foreground"
                          title={alert.matchedData}
                        >
                          {alert.matchedData}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {alert.post?.source ? (
                          <span className="text-muted-foreground text-xs">
                            {alert.post.source.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className="text-muted-foreground text-xs"
                          title={formatDateTime(alert.detectedAt)}
                        >
                          {formatRelativeTime(alert.detectedAt)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
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
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
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
                              <EyeOff className="size-3.5" />
                            ) : (
                              <Eye className="size-3.5" />
                            )}
                          </Button>
                          <Link href={route(`/dashboard/alerts/${alert.id}`)}>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              title="View details"
                            >
                              <Search className="size-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="mt-4 border-t pt-4">
                  <Pagination
                    pagination={pagination}
                    onPageChange={page => setQuery(prev => ({ ...prev, page }))}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
