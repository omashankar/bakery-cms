/**
 * Client-side security-center API. Read-derived from the server (audit trail +
 * live sessions); revoke/logout-all perform REAL session revocation. Best-effort
 * — never throws.
 */
import type { SecurityCenterState } from "@/types/security";

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

export function logoutAllRequest(): Promise<boolean> {
  return send("/api/security-center/logout-all", "POST");
}
