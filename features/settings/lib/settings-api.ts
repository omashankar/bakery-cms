/**
 * Client-side settings API. Best-effort: every call returns null on failure so
 * the existing localStorage flow keeps working if the server is unreachable or
 * the visitor is unauthenticated (backward compatibility during migration).
 */
import type { AppSettings } from "@/types/settings";
import { createHydrationGate } from "@/lib/hydration-gate";
import { noteAuthStatus } from "@/features/auth/lib/session-expiry";

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
 * not yet read the server would push the seeded shop name, `/images/logo.svg`,
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
  /**
   * The shop's own words for what it sells.
   *
   * Absent from this list a save is written to localStorage and never reaches
   * Mongo, so the label would survive until the next device and no further —
   * and a backup would restore a shop without it.
   */
  "labelOverrides",
] as const;

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      noteAuthStatus(res.status);
      return null;
    }
    const json = (await res.json()) as Envelope<T>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

/**
 * The version of each section this browser last read, sent back with its save.
 *
 * A section save replaces the whole section, built from a cache filled once
 * per admin session — so a laptop open since morning saved its morning copy
 * over a change made since on a phone. The server refuses a stale version
 * (409) and the caller merges; see `updateStore` in settings-repository.
 */
const sectionVersions = new Map<string, number>();

/** Record the section versions a full read carried; see `applyServerSettings`. */
export function rememberSectionVersions(data: unknown): void {
  rememberVersions(data);
}

function rememberVersions(data: unknown): void {
  const versions = (data as { sectionVersions?: Record<string, unknown> } | null)?.sectionVersions;
  if (!versions || typeof versions !== "object") return;
  for (const [section, version] of Object.entries(versions)) {
    if (typeof version === "number") sectionVersions.set(section, version);
  }
}

/** Full settings (admin only — 401 for others → null). */
export async function fetchFullSettings() {
  const data = await getJson<Partial<AppSettings>>("/api/settings");
  rememberVersions(data);
  return data;
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
  return (await pushSectionDetailed(section, value)) === "saved";
}

/**
 * `pushSection`, telling a refusal for staleness apart from any other.
 *
 * "conflict" means another device saved this section since this browser read
 * it; the caller can merge and try again. Anything else that is not "saved" is
 * an ordinary failure.
 */
export async function pushSectionDetailed(
  section: string,
  value: unknown,
): Promise<"saved" | "conflict" | "failed"> {
  if (!(await settingsHydration.waitForSettled())) return "failed";

  try {
    const known = sectionVersions.get(section);
    const res = await fetch(`/api/settings/${section}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(known === undefined ? {} : { "X-Section-Version": String(known) }),
      },
      body: JSON.stringify(value),
    });
    if (res.status === 409) return "conflict";
    noteAuthStatus(res.status);
    if (!res.ok) return "failed";
    try {
      const json = (await res.json()) as Envelope<unknown>;
      if (json.success) rememberVersions(json.data);
    } catch {
      // The save landed; a body we cannot read only costs the version, and the
      // next save then goes unchecked rather than failing.
      sectionVersions.delete(section);
    }
    return "saved";
  } catch {
    return "failed";
  }
}

/**
 * Reset ONE section on the server, through the endpoint that exists for it.
 *
 * A "reset" used to be an ordinary PUT of `defaultXSettings`. For eight
 * sections that is indistinguishable from a reset; for SMTP it is not.
 * `defaultSmtpSettings.password` is `""`, and the server reads a blank password
 * as "keep the stored one" — a rule that has to exist, because the form is
 * never sent the password back and would otherwise wipe a working credential
 * every time somebody toggled `enabled`. So Reset wrote the demo host, port and
 * username with the shop's OLD password reattached, told the admin "SMTP
 * settings reset to defaults", and flipped the hint to "No password saved"
 * while the mail transport went on authenticating with it.
 *
 * `POST /api/settings/[section]/reset` does not go through that rule — its own
 * comment already claimed this was the path a reset takes — and it records
 * `settings.reset.<section>` in the audit trail rather than an update.
 *
 * Gated like the writes: not because a reset can clobber (it sends no local
 * data) but because what follows it does — the local cache is rewritten from
 * the defaults, and doing that to an unhydrated cache leaves the seed sitting
 * where the next save will push it.
 */
export async function resetSectionRequest(section: string): Promise<boolean> {
  if (!(await settingsHydration.waitForSettled())) return false;

  try {
    const res = await fetch(`/api/settings/${section}/reset`, { method: "POST" });
    noteAuthStatus(res.status);
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
    noteAuthStatus(res.status);

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
