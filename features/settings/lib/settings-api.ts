/**
 * Client-side settings API. Best-effort: every call returns null on failure so
 * the existing localStorage flow keeps working if the server is unreachable or
 * the visitor is unauthenticated (backward compatibility during migration).
 */
import type { AppSettings } from "@/types/settings";
import { createHydrationGate } from "@/lib/hydration-gate";

interface Envelope<T> {
  success: boolean;
  data: T | null;
}

/**
 * Settled by `SettingsServerSync` once the FULL server copy has been read into
 * the local store.
 *
 * A section PUT is a replace-all: `/api/settings/general` overwrites the whole
 * general object, not the one field the admin touched. Before hydration the
 * local copy is the demo seed — `loadSettings()` writes `defaultAppSettings`
 * into an empty localStorage and returns it — so saving from a browser that had
 * not yet read the server would push "Monginis", `/images/logo.svg`,
 * `Asia/Kolkata` and `INR` over the shop's real identity. One save, silent.
 *
 * Only a full read settles it: the public subset omits smtp/security/analytics,
 * so settling on that would let those sections be sent as seed values too.
 */
export const settingsHydration = createHydrationGate();

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

/**
 * Push one section. Best-effort — never throws.
 *
 * Waits for hydration first: a section PUT replaces the section wholesale, so
 * sending one before the server's copy has been read would overwrite it with
 * this browser's seed. Refusing reports `persisted: false`, which the settings
 * pages already surface as "saved on this device only" and keep Save enabled for.
 */
export async function pushSection(section: string, value: unknown): Promise<boolean> {
  if (!(await settingsHydration.waitForSettled())) return false;

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

export interface TestEmailResult {
  sent: boolean;
  /** The server's reason when `sent` is false — a wrong port, a refused login. */
  error?: string;
}

/**
 * Asks the SERVER to send a test email with the saved SMTP settings.
 *
 * The recipient is the signed-in admin's own address, chosen server-side: taking
 * it from here would turn this into a way to send mail from the shop's domain to
 * anyone. Save before calling — the server reads the stored settings, not the
 * form.
 */
export async function sendTestEmailRequest(): Promise<TestEmailResult> {
  try {
    const res = await fetch("/api/settings/smtp/test", { method: "POST" });
    if (res.ok) return { sent: true };

    // `message`, not `error`. The failure envelope is
    // `{ success, message, errors }` (lib/server/http/response.ts `fail`), so
    // reading `.error` found nothing every time and the admin was shown
    // "The server refused (502)." instead of the provider's actual words —
    // "Invalid login: 535 authentication failed", "connect ETIMEDOUT" — which
    // are the only thing that says WHICH setting is wrong. The controller goes
    // to the trouble of putting the scrubbed provider text in there.
    const json = (await res.json().catch(() => null)) as { message?: string } | null;
    return { sent: false, error: json?.message ?? `The server refused (${res.status}).` };
  } catch {
    return { sent: false, error: "Could not reach the server." };
  }
}
