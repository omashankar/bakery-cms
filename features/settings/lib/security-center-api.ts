/**
 * Client-side security-center API. Read-derived from the server (audit trail +
 * live sessions); revoke/logout-all perform REAL session revocation. Best-effort
 * — never throws.
 */
import type { SecurityCenterState } from "@/types/security";
import { createHydrationGate } from "@/lib/hydration-gate";

interface Envelope<T> {
  success: boolean;
  data: T | null;
}

/**
 * Resolves false on a network failure OR a non-2xx response.
 *
 * The `res.ok` check is the point. Without it this reported success for a 401
 * (expired admin token) and a 500 alike, and the caller went on to tell an admin
 * that a session was revoked while it was still live on the server.
 */
async function send(path: string, method: string, body?: unknown): Promise<boolean> {
  try {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Admin: fetch the derived security-center state (401 → null for non-admins). */
export async function fetchSecurityCenter(): Promise<SecurityCenterState | null> {
  try {
    const res = await fetch("/api/security-center", { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<SecurityCenterState>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export function revokeSessionRequest(sessionId: string): Promise<boolean> {
  return send(`/api/security-center/sessions/${sessionId}`, "DELETE");
}

/**
 * Signs out every session but this one, and reports how many the SERVER revoked.
 *
 * The count has to come from here. Counting the locally cached session list
 * instead reports whatever that list happened to hold when the page loaded: sign
 * in on a phone afterwards and the admin is told "No other active sessions" at
 * the very moment one was revoked; leave a tab open past some expiries and it
 * claims to have signed out devices that were already gone.
 */
export async function logoutAllRequest(): Promise<{ ok: boolean; revoked: number }> {
  try {
    const res = await fetch("/api/security-center/logout-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return { ok: false, revoked: 0 };

    const json = (await res.json().catch(() => null)) as { data?: { revoked?: number } } | null;
    return { ok: true, revoked: json?.data?.revoked ?? 0 };
  } catch {
    return { ok: false, revoked: 0 };
  }
}

/**
 * Settled by `useSecurityCenterServerSync` once /api/security-center answers.
 *
 * The Security header's session count used to open on a flag set inside
 * `refreshCenter()`, which reads the local cache synchronously — so "· 0
 * sessions" was stated as fact before the request had been made, which is
 * exactly what the dash was added to prevent.
 */
export const securityCenterHydration = createHydrationGate();
