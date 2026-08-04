import "server-only";

import { readWhatsAppConnection } from "./whatsapp-credentials.server";
import type { MetaTemplateSummary, WhatsAppApprovalStatus } from "@/types/whatsapp-provider";

export type { MetaTemplateSummary };

/**
 * The WhatsApp Business Cloud API, spoken directly.
 *
 * No SDK: the three calls this app makes are one POST and two GETs against
 * `graph.facebook.com`, and a dependency for that would be more surface than
 * substance. Meta versions its API in the path, so the version is pinned here
 * rather than floating — an unpinned Graph URL silently changes behaviour under
 * a running shop.
 */
const GRAPH_VERSION = "v21.0";
const GRAPH_ROOT = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** A send either happened or it did not. Same contract as `MailResult`. */
export interface WhatsAppResult {
  sent: boolean;
  /** Present when `sent` is false: something an admin can act on. */
  error?: string;
  /** Meta's message id, when it accepted one. */
  messageId?: string;
}

export type WhatsAppUnavailableReason = "disabled" | "incomplete";

export function describeUnavailable(reason: WhatsAppUnavailableReason): string {
  return reason === "disabled"
    ? "WhatsApp sending is turned off in Settings → WhatsApp Templates."
    : "WhatsApp is not connected — a phone number id and access token are required.";
}

/**
 * A number in the form Meta accepts: country code, digits only.
 *
 * Numbers reach this app as an admin or a customer typed them —
 * "+91 98765 43210", "098765 43210", "98765-43210". Meta wants
 * "919876543210" and answers anything else with a generic invalid-parameter
 * error that says nothing about which parameter.
 *
 * A 10-digit number with no country code is the common Indian case and gets
 * `defaultCountryCode`; a leading 0 is a domestic trunk prefix and is dropped.
 * Anything already carrying a country code is left alone. Returns null rather
 * than guessing when the result could not be a phone number — a send to a
 * mangled number is a message delivered to a stranger.
 */
export function normalizePhone(raw: string, defaultCountryCode = "91"): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  const hadPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (!hadPlus) {
    if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
    if (digits.length === 10) digits = `${defaultCountryCode}${digits}`;
  }

  // E.164 allows at most 15 digits, and a country code makes 8 the practical
  // floor. Outside that it is not a number anyone can be messaged on.
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/**
 * Reads Meta's error into one sentence an admin can act on.
 *
 * Graph errors arrive as `{ error: { message, code, error_subcode,
 * error_user_title, error_user_msg } }`. `error_user_msg` is the one written for
 * humans and is usually the most useful, so it wins when present.
 */
async function readError(response: Response): Promise<string> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return `WhatsApp API returned ${response.status}.`;
  }

  const error = (payload as { error?: Record<string, unknown> })?.error;
  if (!error) return `WhatsApp API returned ${response.status}.`;

  const userMessage = typeof error.error_user_msg === "string" ? error.error_user_msg : "";
  const message = typeof error.message === "string" ? error.message : "";
  const text = userMessage || message || `WhatsApp API returned ${response.status}.`;

  // 190 is an expired or revoked token, and the raw text ("Error validating
  // access token") sends an admin looking in the wrong place.
  if (error.code === 190) {
    return "Meta rejected the access token — it has expired or been revoked. Generate a new permanent token and save it again.";
  }
  return text;
}

type ConnectionResult =
  | { ok: true; connection: { phoneNumberId: string; businessAccountId: string; accessToken: string } }
  | { ok: false; reason: WhatsAppUnavailableReason };

/**
 * `requireEnabled: false` is for the connection test and template sync, which
 * must work BEFORE the admin turns sending on — otherwise the only way to find
 * out whether a token is valid is to enable it and wait for a customer's order
 * to fail.
 */
async function getConnection(requireEnabled: boolean): Promise<ConnectionResult> {
  const connection = await readWhatsAppConnection();

  if (!connection.phoneNumberId || !connection.accessToken) {
    return { ok: false, reason: "incomplete" };
  }
  if (requireEnabled && !connection.enabled) return { ok: false, reason: "disabled" };

  return { ok: true, connection };
}

/** Never let the token reach a log line or a toast, whatever Meta echoed back. */
function scrub(message: string, token: string): string {
  return token ? message.split(token).join("***") : message;
}

async function graph(
  path: string,
  token: string,
  init?: { method?: string; body?: unknown },
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    const response = await fetch(`${GRAPH_ROOT}/${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      // An admin action must not hold a request open indefinitely, and an order
      // placement must not wait on Meta at all longer than this.
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });

    if (!response.ok) return { ok: false, error: scrub(await readError(response), token) };
    return { ok: true, data: await response.json() };
  } catch (error) {
    const raw =
      error instanceof Error && error.name === "TimeoutError"
        ? "WhatsApp did not respond in time."
        : error instanceof Error
          ? error.message
          : "Could not reach the WhatsApp API.";
    return { ok: false, error: scrub(raw, token) };
  }
}

/**
 * Sends one approved template. Never throws.
 *
 * `sent` is the only honest basis for telling anyone a message went out — the
 * same rule the mail path was fixed to follow, and for the same reason: this
 * codebase has repeatedly reported deliveries it never attempted.
 *
 * Note what CANNOT be done here: send arbitrary text. Outside a 24-hour window
 * opened by the customer's own message, WhatsApp permits only a template Meta
 * has approved, by name, with positional parameters. That is a platform rule,
 * not a limitation of this function.
 */
export async function sendWhatsAppTemplate(input: {
  to: string;
  metaName: string;
  metaLanguage: string;
  /** Values for `{{1}}`, `{{2}}`, … in that order. */
  parameters: string[];
}): Promise<WhatsAppResult> {
  const result = await getConnection(true);
  if (!result.ok) return { sent: false, error: describeUnavailable(result.reason) };

  const to = normalizePhone(input.to);
  if (!to) return { sent: false, error: "That is not a phone number WhatsApp can deliver to." };
  if (!input.metaName.trim()) {
    return { sent: false, error: "This template is not linked to an approved WhatsApp template yet." };
  }

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: input.metaName.trim(),
      language: { code: input.metaLanguage.trim() || "en" },
      // Only the body component. Header and button parameters exist in Meta's
      // schema and are not offered here, because a template carrying them
      // cannot be filled from what this app stores — sending it with body
      // parameters alone is rejected, which is the correct outcome.
      components: input.parameters.length
        ? [
            {
              type: "body",
              parameters: input.parameters.map((text) => ({ type: "text", text })),
            },
          ]
        : [],
    },
  };

  const response = await graph(`${result.connection.phoneNumberId}/messages`, result.connection.accessToken, {
    method: "POST",
    body,
  });

  if (!response.ok) {
    console.error(`[whatsapp] send failed: ${response.error}`);
    return { sent: false, error: response.error };
  }

  const messageId = (response.data as { messages?: { id?: string }[] })?.messages?.[0]?.id;
  return { sent: true, messageId };
}

export interface WhatsAppAccountInfo {
  /** The business name Meta shows on the sending number. */
  verifiedName: string;
  /** The number as customers see it, e.g. "+91 98765 43210". */
  displayPhoneNumber: string;
  /** Meta's own quality rating for the number: GREEN / YELLOW / RED. */
  qualityRating: string;
}

/**
 * Proves the saved credentials work, by asking Meta who they belong to.
 *
 * Deliberately a real round trip rather than a shape check on the fields. The
 * mail settings page shipped for months with a "test" that inspected the config
 * and reported success; the whole point of this button is to distinguish a
 * typo'd token from a working one, and only Meta can answer that.
 */
export async function verifyWhatsAppConnection(): Promise<
  { ok: true; account: WhatsAppAccountInfo } | { ok: false; error: string }
> {
  const result = await getConnection(false);
  if (!result.ok) return { ok: false, error: describeUnavailable(result.reason) };

  const response = await graph(
    `${result.connection.phoneNumberId}?fields=verified_name,display_phone_number,quality_rating`,
    result.connection.accessToken,
  );
  if (!response.ok) return { ok: false, error: response.error };

  const data = response.data as {
    verified_name?: string;
    display_phone_number?: string;
    quality_rating?: string;
  };

  return {
    ok: true,
    account: {
      verifiedName: data.verified_name ?? "",
      displayPhoneNumber: data.display_phone_number ?? "",
      qualityRating: data.quality_rating ?? "",
    },
  };
}

/** Meta's own status strings, mapped onto the four this app models. */
function toApproval(status: unknown): WhatsAppApprovalStatus {
  switch (String(status).toUpperCase()) {
    case "APPROVED":
      return "approved";
    case "REJECTED":
    case "DISABLED":
    case "PAUSED":
      return "rejected";
    case "PENDING":
    case "IN_APPEAL":
    case "PENDING_DELETION":
      return "pending";
    default:
      return "not_submitted";
  }
}

/** The highest `{{n}}` in the body, which is how many parameters a send needs. */
function countParameters(body: string): number {
  let highest = 0;
  for (const match of body.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) {
    highest = Math.max(highest, Number(match[1]));
  }
  return highest;
}

/**
 * Lists the templates Meta holds for this business account.
 *
 * This is why approval status is never typed by an admin. A dropdown reading
 * "Approved" that nobody had checked with Meta is precisely the class of bug
 * this codebase keeps producing — a green label for something that never
 * happened. The status shown next to a template is the one Meta reported the
 * last time this ran, and nothing else can set it.
 */
export async function listMetaTemplates(): Promise<
  { ok: true; templates: MetaTemplateSummary[] } | { ok: false; error: string }
> {
  const result = await getConnection(false);
  if (!result.ok) return { ok: false, error: describeUnavailable(result.reason) };

  if (!result.connection.businessAccountId) {
    return {
      ok: false,
      error: "Add your WhatsApp Business Account id to list the templates Meta has approved.",
    };
  }

  /**
   * Every page, not the first hundred.
   *
   * Graph pages this endpoint, and a shop with more templates than the page
   * size would have had the rest simply not appear — the binding dropdown would
   * omit them, and the sync would report the templates bound to them as "no
   * longer at Meta" and reset their approval to unsubmitted. A silent cap that
   * looks like a deletion is worse than an error.
   *
   * The 20-page ceiling is a runaway guard, not a product limit: it is 2000
   * templates, far past what Meta itself allows per account.
   */
  const rows: unknown[] = [];
  let path =
    `${result.connection.businessAccountId}/message_templates` +
    `?fields=name,status,language,category,components&limit=100`;

  for (let page = 0; page < 20 && path; page += 1) {
    const response = await graph(path, result.connection.accessToken);
    if (!response.ok) return { ok: false, error: response.error };

    const payload = response.data as {
      data?: unknown[];
      paging?: { cursors?: { after?: string }; next?: string };
    };
    rows.push(...(payload?.data ?? []));

    const after = payload?.paging?.cursors?.after;
    // Built from the cursor rather than following `paging.next` verbatim: that
    // URL is absolute and carries its own access token, and `graph` prepends
    // the pinned API version this app is written against.
    path =
      after && payload?.paging?.next
        ? `${result.connection.businessAccountId}/message_templates` +
          `?fields=name,status,language,category,components&limit=100&after=${encodeURIComponent(after)}`
        : "";
  }

  const templates = rows.map((row) => {
    const item = row as {
      name?: string;
      status?: string;
      language?: string;
      category?: string;
      components?: { type?: string; text?: string }[];
    };
    const body =
      item.components?.find((component) => component.type?.toUpperCase() === "BODY")?.text ?? "";

    return {
      name: item.name ?? "",
      language: item.language ?? "",
      status: toApproval(item.status),
      body,
      parameterCount: countParameters(body),
      category: item.category ?? "",
    };
  });

  return { ok: true, templates: templates.filter((template) => template.name) };
}
