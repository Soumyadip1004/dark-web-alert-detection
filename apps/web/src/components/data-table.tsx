"use client";

import { Badge } from "@dark-web-alert-detection/ui/components/badge";
import { Button } from "@dark-web-alert-detection/ui/components/button";
import {
  Card,
  CardAction,
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
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowUpDownIcon,
  ArrowUpRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import type { Alert } from "@/lib/api";
import {
  formatRelativeTime,
  LEAK_TYPE_CONFIG,
  RISK_LEVEL_CONFIG,
} from "@/lib/api";
import { route } from "@/lib/routes";

// ─── Risk Badge ────────────────────────────────────────

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

// ─── Columns ───────────────────────────────────────────

const columns: ColumnDef<Alert>[] = [
  {
    accessorKey: "riskLevel",
    header: "Risk",
    cell: ({ row }) => <RiskBadge level={row.getValue("riskLevel")} />,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      const a = order[rowA.getValue("riskLevel") as keyof typeof order] ?? 0;
      const b = order[rowB.getValue("riskLevel") as keyof typeof order] ?? 0;
      return a - b;
    },
  },
  {
    accessorKey: "leakType",
    header: "Type",
    cell: ({ row }) => {
      const leakType = row.getValue("leakType") as string;
      const config =
        LEAK_TYPE_CONFIG[leakType as keyof typeof LEAK_TYPE_CONFIG];
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{config?.icon ?? "📄"}</span>
          <span className="truncate text-xs">{config?.label ?? leakType}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "bankName",
    header: "Target",
    cell: ({ row }) => {
      const bankName = row.getValue("bankName") as string | null;
      return (
        <span className="truncate font-medium text-xs">{bankName ?? "—"}</span>
      );
    },
  },
  {
    accessorKey: "matchedData",
    header: "Matched Data",
    cell: ({ row }) => (
      <span className="line-clamp-1 max-w-[200px] truncate text-muted-foreground text-xs">
        {row.getValue("matchedData")}
      </span>
    ),
  },
  {
    id: "source",
    header: "Source",
    cell: ({ row }) => {
      const sourceName = row.original.post?.source?.name;
      return (
        <span className="truncate text-muted-foreground text-xs">
          {sourceName ?? "—"}
        </span>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "detectedAt",
    header: "Detected",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground text-xs tabular-nums">
        {formatRelativeTime(row.getValue("detectedAt"))}
      </span>
    ),
    enableSorting: true,
  },
  {
    accessorKey: "reviewed",
    header: "Status",
    cell: ({ row }) => {
      const reviewed = row.getValue("reviewed") as boolean;
      return reviewed ? (
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
      );
    },
    enableSorting: true,
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <Link href={route(`/dashboard/alerts/${row.original.id}`)}>
        <Button variant="ghost" size="icon-xs">
          <ArrowUpRightIcon className="size-3.5" />
          <span className="sr-only">View alert</span>
        </Button>
      </Link>
    ),
    enableSorting: false,
  },
];

// ─── DataTable Component ───────────────────────────────

interface DataTableProps {
  data: Alert[];
  loading?: boolean;
}

export function DataTable({ data, loading }: DataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "detectedAt", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [riskFilter, setRiskFilter] = React.useState<string>("all");

  const filteredData = React.useMemo(() => {
    if (riskFilter === "all") return data;
    return data.filter(alert => alert.riskLevel === riskFilter);
  }, [data, riskFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Alerts</CardTitle>
        <CardDescription>
          Latest detected threats from dark web sources
        </CardDescription>
        <CardAction>
          <Link href={route("/dashboard/alerts")}>
            <Button variant="outline" size="sm" className="gap-1">
              View all
              <ArrowUpRightIcon className="size-3" />
            </Button>
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Input
            placeholder="Search alerts..."
            value={
              (table.getColumn("matchedData")?.getFilterValue() as string) ?? ""
            }
            onChange={event =>
              table.getColumn("matchedData")?.setFilterValue(event.target.value)
            }
            className="h-8 max-w-xs text-xs"
          />
          <Select
            value={riskFilter}
            onValueChange={value => {
              if (value !== null) setRiskFilter(value);
            }}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs" size="sm">
              <SelectValue placeholder="All risks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All risks</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <TableHead key={header.id} className="text-xs">
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          className="flex items-center gap-1 hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          <ArrowUpDownIcon className="size-3 text-muted-foreground" />
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map(row => (
                  <TableRow
                    key={row.id}
                    className="group cursor-pointer transition-colors hover:bg-muted/50"
                  >
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id} className="py-2">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground text-sm"
                  >
                    No alerts found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {!loading && table.getPageCount() > 1 && (
          <div className="mt-3 flex items-center justify-between text-muted-foreground text-xs">
            <span>
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
              {" · "}
              {filteredData.length} alert{filteredData.length !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-xs"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeftIcon className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon-xs"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRightIcon className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
