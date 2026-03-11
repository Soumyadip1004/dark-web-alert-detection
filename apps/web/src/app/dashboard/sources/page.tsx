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
import { Label } from "@dark-web-alert-detection/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dark-web-alert-detection/ui/components/select";
import { Separator } from "@dark-web-alert-detection/ui/components/separator";
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
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  Loader2,
  Pencil,
  Plus,
  RotateCw,
  Search,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  type CreateSourceBody,
  createSource,
  deleteSource,
  fetchSources,
  formatDateTime,
  formatRelativeTime,
  type PaginationInfo,
  type Priority,
  SOURCE_CATEGORY_CONFIG,
  SOURCE_STATUS_CONFIG,
  type Source,
  type SourceCategory,
  type SourceStatus,
  type SourcesQuery,
  type UpdateSourceBody,
  updateSource,
} from "@/lib/api";

// ─── Status Dot ────────────────────────────────────────

function StatusDot({ status }: { status: SourceStatus }) {
  const config = SOURCE_STATUS_CONFIG[status];
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "inline-block size-2 rounded-full",
          config?.dotClass ?? "bg-gray-400",
        )}
      />
      <span className="text-xs">{config?.label ?? status}</span>
    </div>
  );
}

// ─── Priority Badge ────────────────────────────────────

function PriorityBadge({ priority }: { priority: Priority }) {
  const colorMap: Record<Priority, string> = {
    CRITICAL: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
    HIGH: "border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400",
    MEDIUM:
      "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    LOW: "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400",
  };

  return (
    <Badge variant="outline" className={cn("font-medium", colorMap[priority])}>
      {priority.charAt(0) + priority.slice(1).toLowerCase()}
    </Badge>
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
        <span className="font-medium tabular-nums">{total}</span> sources
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

// ─── Skeleton Loader ───────────────────────────────────

function SourcesTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-2 py-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-40 flex-1" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

// ─── Add / Edit Source Form ────────────────────────────

interface SourceFormData {
  name: string;
  url: string;
  category: SourceCategory;
  priority: Priority;
  status: SourceStatus;
  loginRequired: boolean;
}

const DEFAULT_FORM: SourceFormData = {
  name: "",
  url: "",
  category: "OTHER",
  priority: "MEDIUM",
  status: "ACTIVE",
  loginRequired: false,
};

function SourceForm({
  mode,
  initialData,
  onSubmit,
  onCancel,
  submitting,
}: {
  mode: "create" | "edit";
  initialData: SourceFormData;
  onSubmit: (data: SourceFormData) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState<SourceFormData>(initialData);
  const [errors, setErrors] = useState<
    Partial<Record<keyof SourceFormData, string>>
  >({});

  function validate(): boolean {
    const errs: Partial<Record<keyof SourceFormData, string>> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.url.trim()) errs.url = "URL is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) {
      onSubmit(form);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="source-name">Name</Label>
        <Input
          id="source-name"
          placeholder="e.g. BreachForums"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
        />
        {errors.name && <p className="text-red-500 text-xs">{errors.name}</p>}
      </div>

      {/* URL */}
      <div className="space-y-1.5">
        <Label htmlFor="source-url">URL</Label>
        <Input
          id="source-url"
          placeholder="e.g. http://example.onion"
          value={form.url}
          onChange={e => setForm({ ...form, url: e.target.value })}
        />
        {errors.url && <p className="text-red-500 text-xs">{errors.url}</p>}
      </div>

      {/* Category & Priority row */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select
            value={form.category}
            onValueChange={val =>
              setForm({ ...form, category: val as SourceCategory })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BREACH_FORUM">Breach Forum</SelectItem>
              <SelectItem value="MARKETPLACE">Marketplace</SelectItem>
              <SelectItem value="PASTE_SITE">Paste Site</SelectItem>
              <SelectItem value="LEAK_SITE">Leak Site</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select
            value={form.priority}
            onValueChange={val =>
              setForm({ ...form, priority: val as Priority })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CRITICAL">Critical</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Status & Login Required row */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select
            value={form.status}
            onValueChange={val =>
              setForm({ ...form, status: val as SourceStatus })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="BLOCKED">Blocked</SelectItem>
              <SelectItem value="ERROR">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Login Required</Label>
          <Select
            value={form.loginRequired ? "true" : "false"}
            onValueChange={val =>
              setForm({ ...form, loginRequired: val === "true" })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="false">No</SelectItem>
              <SelectItem value="true">Yes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Actions */}
      <Separator />
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={submitting}
          className="gap-1.5"
        >
          {submitting && <Loader2 className="size-3.5 animate-spin" />}
          {mode === "create" ? "Add Source" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}

// ─── Delete Confirmation ───────────────────────────────

function DeleteConfirmation({
  sourceName,
  onConfirm,
  onCancel,
  deleting,
}: {
  sourceName: string;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="size-4" />
        <p className="font-medium text-sm">Delete Source</p>
      </div>
      <p className="text-muted-foreground text-xs">
        Are you sure you want to delete <strong>{sourceName}</strong>? This will
        also delete all associated posts and alerts. This action cannot be
        undone.
      </p>
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={deleting}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onConfirm}
          disabled={deleting}
          className="gap-1.5"
        >
          {deleting && <Loader2 className="size-3.5 animate-spin" />}
          Delete
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────

type PanelState =
  | { type: "closed" }
  | { type: "create" }
  | { type: "edit"; source: Source }
  | { type: "delete"; source: Source };

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [panel, setPanel] = useState<PanelState>({ type: "closed" });

  // ─── Filters ──────────────────────────────────────
  const [query, setQuery] = useState<SourcesQuery>({
    page: 1,
    limit: 15,
    sortBy: "createdAt",
    sortDir: "desc",
  });
  const [searchInput, setSearchInput] = useState("");

  const loadSources = useCallback(async (q: SourcesQuery) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchSources(q);
      setSources(res.data);
      setPagination(res.pagination);
    } catch (err) {
      console.error("Failed to load sources:", err);
      setError(err instanceof Error ? err.message : "Failed to load sources");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSources(query);
  }, [query, loadSources]);

  function updateFilter(update: Partial<SourcesQuery>) {
    setQuery(prev => ({ ...prev, ...update, page: 1 }));
  }

  function handleSearch() {
    updateFilter({ search: searchInput || undefined });
  }

  function clearFilters() {
    setSearchInput("");
    setQuery({
      page: 1,
      limit: 15,
      sortBy: "createdAt",
      sortDir: "desc",
    });
  }

  const hasActiveFilters = Boolean(
    query.category || query.status || query.priority || query.search,
  );

  // ─── CRUD Handlers ────────────────────────────────

  async function handleCreate(data: SourceFormData) {
    try {
      setSubmitting(true);
      const body: CreateSourceBody = {
        name: data.name.trim(),
        url: data.url.trim(),
        category: data.category,
        priority: data.priority,
        status: data.status,
        loginRequired: data.loginRequired,
      };
      await createSource(body);
      setPanel({ type: "closed" });
      loadSources(query);
    } catch (err) {
      console.error("Failed to create source:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(data: SourceFormData) {
    if (panel.type !== "edit") return;
    try {
      setSubmitting(true);
      const body: UpdateSourceBody = {
        name: data.name.trim(),
        url: data.url.trim(),
        category: data.category,
        priority: data.priority,
        status: data.status,
        loginRequired: data.loginRequired,
      };
      await updateSource(panel.source.id, body);
      setPanel({ type: "closed" });
      loadSources(query);
    } catch (err) {
      console.error("Failed to update source:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (panel.type !== "delete") return;
    try {
      setSubmitting(true);
      await deleteSource(panel.source.id);
      setPanel({ type: "closed" });
      loadSources(query);
    } catch (err) {
      console.error("Failed to delete source:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ─── Header ──────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Sources</h1>
          <p className="text-muted-foreground text-sm">
            Manage monitored dark-web sources.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadSources(query)}
          >
            <RotateCw className="size-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setPanel({ type: "create" })}>
            <Plus className="size-3.5" />
            Add Source
          </Button>
        </div>
      </div>

      {/* ─── Create / Edit / Delete Panel ────────────── */}
      {panel.type !== "closed" && (
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {panel.type === "create"
                  ? "Add New Source"
                  : panel.type === "edit"
                    ? "Edit Source"
                    : "Confirm Deletion"}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setPanel({ type: "closed" })}
              >
                <X className="size-3.5" />
              </Button>
            </div>
            {panel.type === "create" && (
              <CardDescription>
                Add a new dark-web source to be monitored by the crawler.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {panel.type === "create" && (
              <SourceForm
                mode="create"
                initialData={DEFAULT_FORM}
                onSubmit={handleCreate}
                onCancel={() => setPanel({ type: "closed" })}
                submitting={submitting}
              />
            )}
            {panel.type === "edit" && (
              <SourceForm
                mode="edit"
                initialData={{
                  name: panel.source.name,
                  url: panel.source.url,
                  category: panel.source.category,
                  priority: panel.source.priority,
                  status: panel.source.status,
                  loginRequired: panel.source.loginRequired,
                }}
                onSubmit={handleEdit}
                onCancel={() => setPanel({ type: "closed" })}
                submitting={submitting}
              />
            )}
            {panel.type === "delete" && (
              <DeleteConfirmation
                sourceName={panel.source.name}
                onConfirm={handleDelete}
                onCancel={() => setPanel({ type: "closed" })}
                deleting={submitting}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Filters + Table ─────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Monitored Sources</CardTitle>
              {pagination && (
                <CardDescription>
                  {pagination.total} source{pagination.total !== 1 ? "s" : ""}{" "}
                  found
                </CardDescription>
              )}
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-1 text-muted-foreground text-xs"
              >
                <X className="size-3" />
                Clear filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ─── Search & Filter Toolbar ────────────── */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or URL..."
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
              <Select
                value={query.category ?? "_all"}
                onValueChange={val =>
                  updateFilter({
                    category:
                      val === "_all" ? undefined : (val as SourceCategory),
                  })
                }
              >
                <SelectTrigger className="h-8 w-36 text-xs" size="sm">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Categories</SelectItem>
                  <SelectItem value="BREACH_FORUM">Breach Forum</SelectItem>
                  <SelectItem value="MARKETPLACE">Marketplace</SelectItem>
                  <SelectItem value="PASTE_SITE">Paste Site</SelectItem>
                  <SelectItem value="LEAK_SITE">Leak Site</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={query.status ?? "_all"}
                onValueChange={val =>
                  updateFilter({
                    status: val === "_all" ? undefined : (val as SourceStatus),
                  })
                }
              >
                <SelectTrigger className="h-8 w-32 text-xs" size="sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="BLOCKED">Blocked</SelectItem>
                  <SelectItem value="ERROR">Error</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={query.priority ?? "_all"}
                onValueChange={val =>
                  updateFilter({
                    priority: val === "_all" ? undefined : (val as Priority),
                  })
                }
              >
                <SelectTrigger className="h-8 w-32 text-xs" size="sm">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All Priorities</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ─── Table ─────────────────────────────── */}
          {loading ? (
            <SourcesTableSkeleton />
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
                onClick={() => loadSources(query)}
              >
                Try again
              </Button>
            </div>
          ) : sources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Globe className="mb-3 size-10 text-muted-foreground/40" />
              <p className="mb-1 font-medium text-sm">No sources found</p>
              <p className="mb-4 text-muted-foreground text-xs">
                {hasActiveFilters
                  ? "Try adjusting your filters."
                  : "Add your first dark-web source to start monitoring."}
              </p>
              {hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setPanel({ type: "create" })}
                >
                  <Plus className="size-3.5" />
                  Add Source
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden lg:table-cell">URL</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Posts
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      Last Crawled
                    </TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map(source => {
                    const catConfig =
                      SOURCE_CATEGORY_CONFIG[
                        source.category as keyof typeof SOURCE_CATEGORY_CONFIG
                      ];

                    return (
                      <TableRow key={source.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {catConfig?.icon ?? "🌐"}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-xs">
                                {source.name}
                              </p>
                              {source.loginRequired && (
                                <Badge
                                  variant="outline"
                                  className="mt-0.5 text-[10px]"
                                >
                                  <Shield className="mr-0.5 size-2.5" />
                                  Login
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden max-w-[200px] lg:table-cell">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-mono text-[10px] text-muted-foreground">
                              {source.url}
                            </span>
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-primary opacity-0 transition-opacity hover:text-primary/80 group-hover:opacity-100"
                              onClick={e => e.stopPropagation()}
                            >
                              <ExternalLink className="size-3" />
                            </a>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {catConfig?.label ?? source.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <StatusDot status={source.status} />
                        </TableCell>
                        <TableCell>
                          <PriorityBadge priority={source.priority} />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {source._count?.posts ?? 0}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span
                            className="text-muted-foreground text-xs"
                            title={
                              source.lastCrawledAt
                                ? formatDateTime(source.lastCrawledAt)
                                : undefined
                            }
                          >
                            {source.lastCrawledAt
                              ? formatRelativeTime(source.lastCrawledAt)
                              : "Never"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              title="Edit source"
                              onClick={() => setPanel({ type: "edit", source })}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              title="Delete source"
                              onClick={() =>
                                setPanel({ type: "delete", source })
                              }
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
