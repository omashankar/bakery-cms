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
    /**
     * The FIELD message first, then the envelope's.
     *
     * A validation failure puts the useful sentence in `errors` and leaves
     * `message` as the constant "Validation failed", so every auth screen
     * showed a toast that named no rule. That was survivable while the
     * password rule was a bare length check the form already enforced —
     * and became a dead end the moment the server started asking for more
     * than the form did: a locked-out user, holding a ten-minute OTP,
     * rejected without being told why.
     */
    const fieldMessage = Array.isArray(json?.errors)
      ? json.errors.find((entry) => entry?.message)?.message
      : undefined;
    throw new Error(
      fieldMessage || json?.message || "Request failed. Please try again.",
    );
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

export function changePasswordRequest(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  return post<null>("/api/auth/change-password", input);
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

/**
 * The signed-in user, as the SERVER knows them.
 *
 * The admin profile screen invented this: a hardcoded email as its fallback and
 * seeded "created"/"last login" dates, which it then pushed back as fact.
 * `getCurrentUser()` already returns the real `email`, `name`, `role`, `status`,
 * `lastLoginAt` and `createdAt`; nothing was asking for them.
 *
 * Null on any failure — a profile screen that cannot reach the server should
 * show nothing rather than something plausible.
 */
export async function fetchCurrentUser(): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch("/api/auth/me", { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as { success?: boolean; data?: Record<string, unknown> | null };
    return json.success ? (json.data ?? null) : null;
  } catch {
    return null;
  }
}
