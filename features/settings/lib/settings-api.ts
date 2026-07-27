/**
 * Client-side settings API. Best-effort: every call returns null on failure so
 * the existing localStorage flow keeps working if the server is unreachable or
 * the visitor is unauthenticated (backward compatibility during migration).
 */
import type { AppSettings } from "@/types/settings";

interface Envelope<T> {
  success: boolean;
  data: T | null;
}

/** Sections the server accepts (subset of AppSettings + none of activity/updatedAt). */
export const SERVER_SECTIONS = [
  "general",
  "contact",
  "social",
  "security",
  "smtp",
  "analytics",
  "maintenance",
  "commerce",
  "modules",
] as const;

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<T>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

/** Full settings (admin only — 401 for others → null). */
export function fetchFullSettings() {
  return getJson<Partial<AppSettings>>("/api/settings");
}

/** Storefront-safe subset (no auth). */
export function fetchPublicSettings() {
  return getJson<Partial<AppSettings>>("/api/settings/public");
}

/** Push one section. Best-effort — never throws. */
export async function pushSection(section: string, value: unknown): Promise<boolean> {
  try {
    const res = await fetch(`/api/settings/${section}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    return res.ok;
  } catch {
    return false;
  }
}
