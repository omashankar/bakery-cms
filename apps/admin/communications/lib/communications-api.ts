/**
 * Client-side communications API (email templates, WhatsApp templates,
 * notification settings). Whole-collection replace-all dual-write + hydrate.
 * Never throws; every write reports whether the server took it. The SEED is never dual-written; only admin
 * mutations are. These endpoints are admin-guarded.
 */
import { createHydrationGate } from "@/lib/hydration-gate";
import type {
  EmailTemplateRecord,
  WhatsAppTemplateRecord,
} from "@/types/communication";
import type { NotificationSettings } from "@/types/notification";

interface Envelope<T> {
  success: boolean;
  data: T | null;
}

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

/**
 * Whether the SERVER accepted the write. Resolves false on a network failure OR
 * a non-2xx response; never throws.
 *
 * This used to be fire-and-forget — it launched the request into a floating
 * async IIFE and returned void, so a 401 from an expired admin token and a 500
 * were both indistinguishable from success. Every caller then reported "saved"
 * for a change that lives only in this browser and that the next hydration
 * silently reverts.
 */
async function putJson(path: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Settled by this module's `*ServerSync` once the server's copy is loaded. */
export const communicationsHydration = createHydrationGate();

/**
 * A replace-all write sends the ENTIRE local list. Waiting for hydration is what
 * stops a browser that never loaded the server's copy from overwriting it — see
 * `createHydrationGate`.
 */
async function guardedPut(path: string, body: unknown): Promise<boolean> {
  if (!(await communicationsHydration.waitForSettled())) return false;
  return putJson(path, body);
}

/**
 * Awaited variant that reports whether the server actually accepted the write.
 *
 * `putJson` above is deliberately fire-and-forget, but a screen that shows a
 * "Saved" confirmation must not use it: a 401 (expired token) or 500 would leave
 * the admin believing a preference reached the server when only localStorage
 * has it, and the next device would silently show the old value.
 */
async function putJsonResult(path: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const EMAIL_PATH = "/api/communications/templates/email-templates";
const WHATSAPP_PATH = "/api/communications/templates/whatsapp-templates";
const NOTIFICATION_SETTINGS_PATH = "/api/communications/notification-settings";

export const fetchEmailTemplates = () => getJson<EmailTemplateRecord[]>(EMAIL_PATH);
export const replaceEmailTemplatesRequest = (items: EmailTemplateRecord[]) =>
  guardedPut(EMAIL_PATH, items);

export const fetchWhatsAppTemplates = () => getJson<WhatsAppTemplateRecord[]>(WHATSAPP_PATH);
export const replaceWhatsAppTemplatesRequest = (items: WhatsAppTemplateRecord[]) =>
  guardedPut(WHATSAPP_PATH, items);

export const fetchNotificationSettings = () =>
  getJson<NotificationSettings>(NOTIFICATION_SETTINGS_PATH);
/** Resolves false when the server rejected the write — callers must surface it. */
export const replaceNotificationSettingsRequest = (settings: NotificationSettings) =>
  putJsonResult(NOTIFICATION_SETTINGS_PATH, settings);

/**
 * Really sends a test of one template, to the signed-in admin.
 *
 * No recipient is sent: the server takes it from the session. The dialog used to
 * offer a free-text address, and honouring that would have turned an admin
 * convenience into a way to send mail from the shop's domain to anyone.
 */
export async function sendTemplateTestRequest(
  slug: string,
): Promise<{ sent: boolean; to?: string; error?: string }> {
  try {
    const res = await fetch("/api/communications/templates/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });

    const json = (await res.json().catch(() => null)) as
      | { data?: { to?: string }; message?: string }
      | null;

    if (res.ok) return { sent: true, to: json?.data?.to };
    return { sent: false, error: json?.message ?? `The server refused (${res.status}).` };
  } catch {
    return { sent: false, error: "Could not reach the server." };
  }
}
