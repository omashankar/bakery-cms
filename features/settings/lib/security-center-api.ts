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

async function send(path: string, method: string, body?: unknown): Promise<void> {
  try {
    await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // best-effort
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

export function revokeSessionRequest(sessionId: string): void {
  void send(`/api/security-center/sessions/${sessionId}`, "DELETE");
}

export function logoutAllRequest(): void {
  void send("/api/security-center/logout-all", "POST");
}
