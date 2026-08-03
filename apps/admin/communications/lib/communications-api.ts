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

/**
 * ONE GATE PER COLLECTION.
 *
 * There used to be a single `communicationsHydration` covering all three, and
 * its sync opened it only `if (email && whatsapp)`. So a WhatsApp fetch that
 * failed — a blip, a 500, a slow cold start past the deadline — permanently
 * blocked EMAIL template saves for that whole session, and the admin was told
 * "saved on this device only" for a store that was perfectly reachable. One
 * gate vouching for collections it never read is the same mistake the
 * admin-config gate made in the other direction (opening when ANY ONE of four
 * arrived); both are fixed by making a gate answer for exactly what it read.
 */
export const emailTemplatesHydration = createHydrationGate();
export const whatsappTemplatesHydration = createHydrationGate();
export const notificationSettingsHydration = createHydrationGate();

/**
 * A replace-all write sends the ENTIRE local list. Waiting for hydration is what
 * stops a browser that never loaded the server's copy from overwriting it — see
 * `createHydrationGate`.
 *
 * Note what this can and cannot do: it holds the REQUEST until the gate opens,
 * and the body was composed by the caller. A caller that read its list before
 * waiting hands over a stale payload and this dutifully ships it — which is
 * exactly what both template repositories used to do. They wait first now.
 */
async function guardedPut(
  gate: { waitForSettled: () => Promise<boolean> },
  path: string,
  body: unknown,
): Promise<boolean> {
  if (!(await gate.waitForSettled())) return false;
  return putJson(path, body);
}

const EMAIL_PATH = "/api/communications/templates/email-templates";
const WHATSAPP_PATH = "/api/communications/templates/whatsapp-templates";
const NOTIFICATION_SETTINGS_PATH = "/api/communications/notification-settings";

export const fetchEmailTemplates = () => getJson<EmailTemplateRecord[]>(EMAIL_PATH);
export const replaceEmailTemplatesRequest = (items: EmailTemplateRecord[]) =>
  guardedPut(emailTemplatesHydration, EMAIL_PATH, items);

export const fetchWhatsAppTemplates = () => getJson<WhatsAppTemplateRecord[]>(WHATSAPP_PATH);
export const replaceWhatsAppTemplatesRequest = (items: WhatsAppTemplateRecord[]) =>
  guardedPut(whatsappTemplatesHydration, WHATSAPP_PATH, items);

export const fetchNotificationSettings = () =>
  getJson<NotificationSettings>(NOTIFICATION_SETTINGS_PATH);
/**
 * Resolves false when the server rejected the write — callers must surface it.
 *
 * Gated like the others. This was the one PUT in this file that skipped the
 * gate entirely, so a browser that had never read the server's notification
 * settings could replace them with its local defaults.
 */
export const replaceNotificationSettingsRequest = (settings: NotificationSettings) =>
  guardedPut(notificationSettingsHydration, NOTIFICATION_SETTINGS_PATH, settings);

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
