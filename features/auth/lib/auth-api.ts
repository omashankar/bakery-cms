/**
 * Client-side auth API calls. Thin wrappers over the /api/auth/* endpoints that
 * unwrap the standard response envelope and throw the server message on failure.
 * Auth tokens live in httpOnly cookies (set by the server) — nothing sensitive
 * is handled here.
 */

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors: { field: string; message: string }[] | null;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || "Request failed. Please try again.");
  }
  return json.data as T;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  status: string;
}

export function loginRequest(input: { email: string; password: string; rememberMe: boolean }) {
  return post<AuthUser>("/api/auth/login", input);
}

/**
 * Silently renew the short-lived access token from the (30-day) refresh cookie.
 * Single-flight: many callers (the periodic tick, a tab refocus) can ask at once,
 * but only one request goes out and everyone awaits it. Returns false when the
 * refresh token is missing/expired/revoked (i.e. the user must sign in again).
 */
let refreshInFlight: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST" });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export function logoutRequest() {
  return post<null>("/api/auth/logout");
}

export function forgotPasswordRequest(email: string) {
  return post<null>("/api/auth/forgot-password", { email });
}

export function verifyOtpRequest(email: string, otp: string) {
  return post<null>("/api/auth/verify-otp", { email, otp });
}

export function resetPasswordRequest(input: {
  email: string;
  otp: string;
  password: string;
  confirmPassword: string;
}) {
  return post<null>("/api/auth/reset-password", input);
}
