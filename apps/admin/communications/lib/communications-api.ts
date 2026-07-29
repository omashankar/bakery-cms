/**
 * Client-side communications API (email templates, WhatsApp templates,
 * notification settings). Whole-collection replace-all dual-write + hydrate.
 * Best-effort — never throws. The SEED is never dual-written; only admin
 * mutations are. These endpoints are admin-guarded.
 */
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

function putJson(path: string, body: unknown): void {
  void (async () => {
    try {
      await fetch(path, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      // best-effort
    }
  })();
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
  putJson(EMAIL_PATH, items);

export const fetchWhatsAppTemplates = () => getJson<WhatsAppTemplateRecord[]>(WHATSAPP_PATH);
export const replaceWhatsAppTemplatesRequest = (items: WhatsAppTemplateRecord[]) =>
  putJson(WHATSAPP_PATH, items);

export const fetchNotificationSettings = () =>
  getJson<NotificationSettings>(NOTIFICATION_SETTINGS_PATH);
/** Resolves false when the server rejected the write — callers must surface it. */
export const replaceNotificationSettingsRequest = (settings: NotificationSettings) =>
  putJsonResult(NOTIFICATION_SETTINGS_PATH, settings);
