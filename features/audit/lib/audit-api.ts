/**
 * Client-side audit-log API. Read-only — the trail is append-only and written
 * server-side. Best-effort: returns null on failure / unauthorized so callers
 * degrade gracefully.
 */
import type { AuditLogEntry } from "@/types/audit";
import { noteAuthStatus } from "@/features/auth/lib/session-expiry";

export interface AuditPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuditQueryParams {
  action?: string;
  actorEmail?: string;
  targetType?: string;
  status?: "success" | "failure";
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

interface Envelope<T> {
  success: boolean;
  data: T | null;
  pagination: AuditPagination | null;
}

export async function fetchAuditLogs(
  params: AuditQueryParams = {},
): Promise<{ items: AuditLogEntry[]; pagination: AuditPagination | null } | null> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();

  try {
    const res = await fetch(`/api/audit-logs${qs ? `?${qs}` : ""}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      noteAuthStatus(res.status);
      return null;
    }
    const json = (await res.json()) as Envelope<AuditLogEntry[]>;
    if (!json.success || !json.data) return null;
    return { items: json.data, pagination: json.pagination };
  } catch {
    return null;
  }
}
