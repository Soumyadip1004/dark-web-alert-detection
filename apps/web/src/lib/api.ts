import { env } from "@dark-web-alert-detection/env/web";

const BASE_URL = env.NEXT_PUBLIC_SERVER_URL;

// ─── Types ─────────────────────────────────────────────

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

export interface SingleResponse<T> {
  data: T;
}

export interface ErrorResponse {
  error: string;
  existingId?: string;
}

// ─── Domain Types ──────────────────────────────────────

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type LeakType =
  | "CREDIT_CARD"
  | "CREDENTIAL_DUMP"
  | "BANK_DATA"
  | "PII"
  | "OTHER";
export type SourceCategory =
  | "BREACH_FORUM"
  | "MARKETPLACE"
  | "PASTE_SITE"
  | "LEAK_SITE"
  | "OTHER";
export type SourceStatus = "ACTIVE" | "INACTIVE" | "BLOCKED" | "ERROR";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Alert {
  id: string;
  postId: string;
  bankName: string | null;
  leakType: LeakType;
  riskLevel: RiskLevel;
  matchedData: string;
  detectedAt: string;
  reviewed: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  post?: {
    id: string;
    url: string;
    title: string | null;
    author: string | null;
    scrapedAt: string;
    content?: string;
    analyzedAt?: string | null;
    source?: Source;
    _count?: { alerts: number };
  };
}

export interface Source {
  id: string;
  name: string;
  url: string;
  category: SourceCategory;
  priority: Priority;
  status: SourceStatus;
  loginRequired: boolean;
  lastCrawledAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { posts: number };
  posts?: Array<{
    id: string;
    url: string;
    title: string | null;
    author: string | null;
    scrapedAt: string;
    analyzedAt: string | null;
    _count?: { alerts: number };
  }>;
}

export interface DashboardStats {
  alerts: {
    total: number;
    unreviewed: number;
    last24h: number;
    last7d: number;
    last30d: number;
    byRiskLevel: Record<RiskLevel, number>;
    byLeakType: Record<string, number>;
  };
  sources: {
    total: number;
    active: number;
  };
  posts: {
    total: number;
    last24h: number;
  };
  topBanks: Array<{ bankName: string; count: number }>;
  recentAlerts: Alert[];
}

export interface TimelineEntry {
  date: string;
  total: number;
  CRITICAL: number;
  HIGH: number;
  MEDIUM: number;
  LOW: number;
}

// ─── Query Params ──────────────────────────────────────

export interface AlertsQuery {
  page?: number;
  limit?: number;
  riskLevel?: RiskLevel;
  leakType?: LeakType;
  reviewed?: boolean;
  bankName?: string;
  search?: string;
  from?: string;
  to?: string;
  sortBy?: "detectedAt" | "riskLevel" | "leakType" | "bankName";
  sortDir?: "asc" | "desc";
}

export interface SourcesQuery {
  page?: number;
  limit?: number;
  category?: SourceCategory;
  status?: SourceStatus;
  priority?: Priority;
  search?: string;
  sortBy?: "createdAt" | "name" | "priority" | "status" | "lastCrawledAt";
  sortDir?: "asc" | "desc";
}

export interface CreateSourceBody {
  name: string;
  url: string;
  category: SourceCategory;
  priority?: Priority;
  status?: SourceStatus;
  loginRequired?: boolean;
}

export interface UpdateSourceBody {
  name?: string;
  url?: string;
  category?: SourceCategory;
  priority?: Priority;
  status?: SourceStatus;
  loginRequired?: boolean;
}

export interface ReviewAlertBody {
  reviewed?: boolean;
  reviewedBy?: string;
}

// ─── Fetch Wrapper ─────────────────────────────────────

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;

  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = (await res.json()) as ErrorResponse;
      if (body.error) message = body.error;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, message);
  }

  return res.json() as Promise<T>;
}

// ─── Alert Endpoints ───────────────────────────────────

export async function fetchAlerts(
  query: AlertsQuery = {},
): Promise<PaginatedResponse<Alert>> {
  const qs = buildQueryString(query as Record<string, unknown>);
  return request<PaginatedResponse<Alert>>(`/api/alerts${qs}`);
}

export async function fetchAlert(id: string): Promise<SingleResponse<Alert>> {
  return request<SingleResponse<Alert>>(`/api/alerts/${id}`);
}

export async function reviewAlert(
  id: string,
  body: ReviewAlertBody = {},
): Promise<SingleResponse<Alert>> {
  return request<SingleResponse<Alert>>(`/api/alerts/${id}/review`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// ─── Source Endpoints ──────────────────────────────────

export async function fetchSources(
  query: SourcesQuery = {},
): Promise<PaginatedResponse<Source>> {
  const qs = buildQueryString(query as Record<string, unknown>);
  return request<PaginatedResponse<Source>>(`/api/sources${qs}`);
}

export async function fetchSource(id: string): Promise<SingleResponse<Source>> {
  return request<SingleResponse<Source>>(`/api/sources/${id}`);
}

export async function createSource(
  body: CreateSourceBody,
): Promise<SingleResponse<Source>> {
  return request<SingleResponse<Source>>("/api/sources", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateSource(
  id: string,
  body: UpdateSourceBody,
): Promise<SingleResponse<Source>> {
  return request<SingleResponse<Source>>(`/api/sources/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteSource(
  id: string,
): Promise<SingleResponse<{ id: string; deleted: boolean }>> {
  return request<SingleResponse<{ id: string; deleted: boolean }>>(
    `/api/sources/${id}`,
    { method: "DELETE" },
  );
}

// ─── Stats Endpoints ───────────────────────────────────

export async function fetchStats(): Promise<SingleResponse<DashboardStats>> {
  return request<SingleResponse<DashboardStats>>("/api/stats");
}

export async function fetchTimeline(
  days?: number,
): Promise<SingleResponse<TimelineEntry[]>> {
  const qs = days !== undefined ? buildQueryString({ days }) : "";
  return request<SingleResponse<TimelineEntry[]>>(`/api/stats/timeline${qs}`);
}

// ─── Helpers ───────────────────────────────────────────

export const RISK_LEVEL_CONFIG: Record<
  RiskLevel,
  { label: string; color: string; bgClass: string; textClass: string }
> = {
  CRITICAL: {
    label: "Critical",
    color: "#ef4444",
    bgClass: "bg-red-500/10 dark:bg-red-500/20",
    textClass: "text-red-600 dark:text-red-400",
  },
  HIGH: {
    label: "High",
    color: "#f97316",
    bgClass: "bg-orange-500/10 dark:bg-orange-500/20",
    textClass: "text-orange-600 dark:text-orange-400",
  },
  MEDIUM: {
    label: "Medium",
    color: "#eab308",
    bgClass: "bg-yellow-500/10 dark:bg-yellow-500/20",
    textClass: "text-yellow-600 dark:text-yellow-400",
  },
  LOW: {
    label: "Low",
    color: "#22c55e",
    bgClass: "bg-green-500/10 dark:bg-green-500/20",
    textClass: "text-green-600 dark:text-green-400",
  },
};

export const LEAK_TYPE_CONFIG: Record<
  LeakType,
  { label: string; icon: string }
> = {
  CREDIT_CARD: { label: "Credit Card", icon: "💳" },
  CREDENTIAL_DUMP: { label: "Credentials", icon: "🔑" },
  BANK_DATA: { label: "Bank Data", icon: "🏦" },
  PII: { label: "PII", icon: "👤" },
  OTHER: { label: "Other", icon: "📄" },
};

export const SOURCE_CATEGORY_CONFIG: Record<
  SourceCategory,
  { label: string; icon: string }
> = {
  BREACH_FORUM: { label: "Breach Forum", icon: "💬" },
  MARKETPLACE: { label: "Marketplace", icon: "🛒" },
  PASTE_SITE: { label: "Paste Site", icon: "📋" },
  LEAK_SITE: { label: "Leak Site", icon: "💧" },
  OTHER: { label: "Other", icon: "🌐" },
};

export const SOURCE_STATUS_CONFIG: Record<
  SourceStatus,
  { label: string; dotClass: string }
> = {
  ACTIVE: { label: "Active", dotClass: "bg-green-500" },
  INACTIVE: { label: "Inactive", dotClass: "bg-gray-400" },
  BLOCKED: { label: "Blocked", dotClass: "bg-red-500" },
  ERROR: { label: "Error", dotClass: "bg-yellow-500" },
};

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export { ApiError };
