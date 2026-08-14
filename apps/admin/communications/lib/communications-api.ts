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
import type { MetaSyncSummary, WhatsAppConnectionStatus } from "@/types/whatsapp-provider";

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
 * A "have we read it yet" marker, not a write guard.
 *
 * Notification state is written as a delta, so nothing about it needs gating —
 * this exists only so `ensureCommunicationsHydrated` fetches it once per
 * session rather than on every call.
 */
export const notificationStateHydration = createHydrationGate();

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
/**
 * `knownIds` is the ids this browser BELIEVED existed before its edit.
 *
 * A replace-all otherwise asserts "these are all the templates there are", so
 * a save from a tab opened an hour ago deleted every template another admin
 * had added since — both saves reporting success, with nothing left to show
 * the missing ones had existed. Delivery zones send the same thing.
 */
export const replaceEmailTemplatesRequest = (
  items: EmailTemplateRecord[],
  knownIds?: string[],
) =>
  guardedPut(
    emailTemplatesHydration,
    EMAIL_PATH,
    knownIds ? { items, knownIds } : items,
  );

export const fetchWhatsAppTemplates = () => getJson<WhatsAppTemplateRecord[]>(WHATSAPP_PATH);
export const replaceWhatsAppTemplatesRequest = (
  items: WhatsAppTemplateRecord[],
  knownIds?: string[],
) =>
  guardedPut(
    whatsappTemplatesHydration,
    WHATSAPP_PATH,
    knownIds ? { items, knownIds } : items,
  );

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

const NOTIFICATION_STATE_PATH = "/api/communications/notification-state";

/** Which alerts THIS admin has read and dismissed, kept server-side. */
export interface NotificationStatePayload {
  read: string[];
  dismissed: string[];
}

export interface NotificationStateDelta {
  read?: string[];
  dismissed?: string[];
  undismissed?: string[];
}

export const fetchNotificationState = () =>
  getJson<NotificationStatePayload>(NOTIFICATION_STATE_PATH);

/**
 * A DELTA, and deliberately not behind a hydration gate.
 *
 * Every other write in this file is a replace-all and has to wait for the
 * server's copy, or it overwrites it with whatever this browser happens to
 * hold. This one cannot: it names the handful of ids the admin just acted on
 * and the server unions them in, so a browser that has read nothing still
 * cannot erase anything. Gating it would only mean losing the click that
 * happened during the first second of a page load.
 */
export async function pushNotificationState(
  delta: NotificationStateDelta,
): Promise<boolean> {
  if (
    (delta.read?.length ?? 0) === 0 &&
    (delta.dismissed?.length ?? 0) === 0 &&
    (delta.undismissed?.length ?? 0) === 0
  ) {
    return true;
  }

  try {
    const res = await fetch(NOTIFICATION_STATE_PATH, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(delta),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * A POST whose failure message is worth showing.
 *
 * The error text these endpoints return is the whole point of pressing the
 * button — "Meta rejected the access token", "no contact phone number is set" —
 * so unlike `putJson` this keeps it rather than collapsing everything to false.
 */
async function postJson<T>(
  path: string,
  body?: unknown,
): Promise<{ ok: true; data: T | null } | { ok: false; error: string }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });

    const json = (await res.json().catch(() => null)) as
      | { data?: T; message?: string }
      | null;

    if (res.ok) return { ok: true, data: json?.data ?? null };
    return { ok: false, error: json?.message ?? `The server refused (${res.status}).` };
  } catch {
    return { ok: false, error: "Could not reach the server." };
  }
}

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
  const result = await postJson<{ to?: string }>("/api/communications/templates/test", { slug });
  return result.ok ? { sent: true, to: result.data?.to } : { sent: false, error: result.error };
}

const WHATSAPP_CONNECTION_PATH = "/api/communications/whatsapp/connection";

/**
 * The connection STATUS — which fields are set, never the access token.
 *
 * There is deliberately no way to read the token back. It can message any
 * customer who has ever contacted the business, from the shop's verified
 * number, and the browser has no use for it.
 */
export const fetchWhatsAppConnection = () =>
  getJson<WhatsAppConnectionStatus>(WHATSAPP_CONNECTION_PATH);

/**
 * Saves the connection. An empty `accessToken` means "keep the stored one".
 *
 * Not gated, and it is worth saying why, because everything else in this file
 * is. A gate exists to stop a whole-collection REPLACE from a browser that
 * never read the server's copy. This is a four-field form the admin has just
 * filled in by hand, sent as itself — there is no list to clobber, and the one
 * field it could destroy (the token) is protected server-side by the
 * blank-means-keep rule instead.
 */
export async function saveWhatsAppConnectionRequest(input: {
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  enabled: boolean;
}): Promise<boolean> {
  return putJson(WHATSAPP_CONNECTION_PATH, input);
}

/** Asks Meta who the saved credentials belong to. A real round trip. */
export const verifyWhatsAppRequest = () =>
  postJson<{ verifiedName: string; displayPhoneNumber: string; qualityRating: string }>(
    "/api/communications/whatsapp/verify",
  );

/** Pulls Meta's approval statuses onto the stored templates. */
export const syncWhatsAppTemplatesRequest = () =>
  postJson<MetaSyncSummary>("/api/communications/whatsapp/sync");

/**
 * Really sends a test WhatsApp of one template.
 *
 * No recipient is sent, for the same reason as the email test: the server uses
 * the shop's own contact number. A free-text box here would be a way to message
 * any number at all from a verified business account.
 */
export async function sendWhatsAppTestRequest(
  slug: string,
): Promise<{ sent: boolean; to?: string; error?: string }> {
  const result = await postJson<{ to?: string }>("/api/communications/whatsapp/test", { slug });
  return result.ok ? { sent: true, to: result.data?.to } : { sent: false, error: result.error };
}

/**
 * A RESTORE of a template collection, not a save.
 *
 * `replaceEmailTemplatesRequest(items)` with no `knownIds` deletes nothing —
 * that is deliberate, so an ordinary save from a stale tab cannot remove a
 * template another admin added. A restore means the opposite: the file IS the
 * intended state, and a template the backup does not contain must go, or the
 * shop is left sending wording it thought it had replaced.
 *
 * The CURRENT server ids are read first and sent as the known set, exactly as
 * `restoreCouponsRequest` and `restoreZonesRequest` do. A failed read returns
 * false rather than falling back to a blind replace.
 */
export async function restoreEmailTemplatesRequest(
  items: EmailTemplateRecord[],
): Promise<boolean> {
  const current = await fetchEmailTemplates();
  if (current === null) return false;
  return replaceEmailTemplatesRequest(items, current.map((item) => item.id));
}

export async function restoreWhatsAppTemplatesRequest(
  items: WhatsAppTemplateRecord[],
): Promise<boolean> {
  const current = await fetchWhatsAppTemplates();
  if (current === null) return false;
  return replaceWhatsAppTemplatesRequest(items, current.map((item) => item.id));
}
