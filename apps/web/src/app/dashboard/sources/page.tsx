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
  ChevronLeftIcon,
  ChevronRightIcon,
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

  // Simple validation
  function validate() {
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.url.trim()) errs.url = "URL is required";
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="source-name" className="text-xs">
            Name
          </Label>
          <Input
            id="source-name"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. BreachForums"
            className="h-8 text-xs"
          />
          {errors.name && (
            <p className="text-destructive text-xs">{errors.name}</p>
          )}
        </div>

        {/* URL */}
        <div className="space-y-1.5">
          <Label htmlFor="source-url" className="text-xs">
            URL
          </Label>
          <Input
            id="source-url"
            value={form.url}
            onChange={e => setForm({ ...form, url: e.target.value })}
            placeholder="e.g. http://example.onion"
            className="h-8 text-xs"
          />
          {errors.url && (
            <p className="text-destructive text-xs">{errors.url}</p>
          )}
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label className="text-xs">Category</Label>
          <Select
            value={form.category}
            onValueChange={val =>
              setForm({ ...form, category: val as SourceCategory })
            }
          >
            <SelectTrigger className="h-8 text-xs" size="sm">
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

        {/* Priority */}
        <div className="space-y-1.5">
          <Label className="text-xs">Priority</Label>
          <Select
            value={form.priority}
            onValueChange={val =>
              setForm({ ...form, priority: val as Priority })
            }
          >
            <SelectTrigger className="h-8 text-xs" size="sm">
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

        {/* Status */}
        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <Select
            value={form.status}
            onValueChange={val =>
              setForm({ ...form, status: val as SourceStatus })
            }
          >
            <SelectTrigger className="h-8 text-xs" size="sm">
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

        {/* Login Required */}
        <div className="flex items-end gap-2 pb-0.5">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={form.loginRequired}
              onChange={e =>
                setForm({ ...form, loginRequired: e.target.checked })
              }
              className="size-3.5 rounded border"
            />
            Requires login
          </label>
        </div>
      </div>

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
          {mode === "create" ? "Create Source" : "Save Changes"}
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

// ─── Column config ─────────────────────────────────────

const columnHeaders: {
  key: string;
  label: string;
  className?: string;
}[] = [
  { key: "name", label: "Name" },
  { key: "url", label: "URL", className: "hidden lg:table-cell" },
  { key: "category", label: "Category" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "posts", label: "Posts", className: "hidden md:table-cell" },
  {
    key: "lastCrawled",
    label: "Last Crawled",
    className: "hidden md:table-cell",
  },
  { key: "actions", label: "", className: "w-24 text-right" },
];

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
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-semibold text-2xl tracking-tight">
              Monitored Sources
            </h1>
            {pagination && (
              <Badge variant="secondary" className="tabular-nums">
                {pagination.total}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            Manage monitored dark-web sources.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => loadSources(query)}
          >
            <RotateCw className="size-3.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setPanel({ type: "create" })}
          >
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
      <div className="space-y-4">
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

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-1 text-muted-foreground text-xs"
              >
                <X className="size-3" />
                Clear
              </Button>
            )}
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
                    {col.label}
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
                        onClick={() => loadSources(query)}
                      >
                        Try again
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sources.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columnHeaders.length}
                    className="h-24 text-center"
                  >
                    <div className="flex flex-col items-center justify-center py-16">
                      <Globe className="mb-3 size-10 text-muted-foreground/40" />
                      <p className="mb-1 font-medium text-sm">
                        No sources found
                      </p>
                      <p className="mb-4 text-muted-foreground text-xs">
                        {hasActiveFilters
                          ? "Try adjusting your filters."
                          : "Add your first dark-web source to start monitoring."}
                      </p>
                      {hasActiveFilters ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearFilters}
                        >
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
                  </TableCell>
                </TableRow>
              ) : (
                sources.map(source => {
                  const catConfig =
                    SOURCE_CATEGORY_CONFIG[
                      source.category as keyof typeof SOURCE_CATEGORY_CONFIG
                    ];

                  return (
                    <TableRow
                      key={source.id}
                      className="group cursor-pointer transition-colors hover:bg-muted/50"
                    >
                      {/* Name */}
                      <TableCell className="py-2">
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

                      {/* URL */}
                      <TableCell className="hidden max-w-[200px] py-2 lg:table-cell">
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

                      {/* Category */}
                      <TableCell className="py-2">
                        <Badge variant="secondary" className="font-normal">
                          {catConfig?.label ?? source.category}
                        </Badge>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-2">
                        <StatusDot status={source.status} />
                      </TableCell>

                      {/* Priority */}
                      <TableCell className="py-2">
                        <PriorityBadge priority={source.priority} />
                      </TableCell>

                      {/* Posts */}
                      <TableCell className="hidden py-2 md:table-cell">
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {source._count?.posts ?? 0}
                        </span>
                      </TableCell>

                      {/* Last Crawled */}
                      <TableCell className="hidden py-2 md:table-cell">
                        <span
                          className="whitespace-nowrap text-muted-foreground text-xs"
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

                      {/* Actions */}
                      <TableCell className="py-2">
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
                            onClick={() => setPanel({ type: "delete", source })}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
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
              {pagination.total} source{pagination.total !== 1 ? "s" : ""}
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
