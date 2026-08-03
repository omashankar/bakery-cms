import { sendMail, type MailResult } from "@/lib/server/mail/send-mail";
import { renderTemplate } from "@/lib/template-render";
import { getSettings } from "@/features/settings/server/settings.service";
import { getSiteLayout } from "@/features/site-layout/server/site-layout.service";
import type { EmailTemplateRecord } from "@/types/communication";
import type { SeoStore } from "@/types/seo";
import type { ContactSettings, GeneralSettings } from "@/types/settings";

import { getTemplates } from "./communications.service";

/**
 * Sends one of the admin's stored email templates.
 *
 * The templates already existed and were editable; nothing rendered or sent
 * them. This is the path that makes that page mean something: the copy an admin
 * writes is the copy the customer receives.
 */

/** The transactional templates this codebase actually triggers. */
export type EmailTemplateSlug = "order_confirmation" | "password_reset" | "refund_processed";

/**
 * Used when the stored template is missing or still a draft.
 *
 * A fallback matters more than it looks: without one, deleting a template or
 * leaving it unpublished would silently stop password resets, and the failure
 * would surface as customers unable to get into their accounts rather than as
 * anything pointing at the template page.
 */
const FALLBACKS: Record<EmailTemplateSlug, { subject: string; body: string }> = {
  order_confirmation: {
    subject: "Order {{order_number}} confirmed",
    body:
      "Hi {{customer_name}},\n\nThank you for your order {{order_number}}.\n\n" +
      "Order total: {{order_total}}\nPayment: {{payment_method}}\n" +
      "Delivery: {{delivery_date}}\n\n— {{store_name}}",
  },
  /**
   * A refund the gateway has accepted.
   *
   * Deliberately says the money is on its way rather than that it has arrived:
   * a card refund takes days to appear on the customer's statement, and a
   * "refunded" email followed by nothing in the account for a week generates
   * exactly the support call it was meant to prevent.
   */
  refund_processed: {
    subject: "Refund for order {{order_number}}",
    body:
      "Hi {{customer_name}},\n\nWe have refunded {{refund_amount}} for your order " +
      "{{order_number}}.\n\nIt is on its way back to the account you paid from and " +
      "usually takes {{refund_eta}} to appear, depending on your bank.\n\n" +
      "Reference: {{refund_reference}}\n\n— {{store_name}}",
  },
  password_reset: {
    subject: "Reset your {{store_name}} password",
    body:
      "Hi {{customer_name}},\n\nUse this code to reset your password:\n\n" +
      "{{reset_code}}\n\nIt expires in {{expires_in}}. If you did not request " +
      "this, ignore this email — your password has not changed.\n\n— {{store_name}}",
  },
};

/** Only an ACTIVE template is a template. A draft is work in progress. */
async function findTemplate(slug: EmailTemplateSlug): Promise<EmailTemplateRecord | null> {
  try {
    const templates = (await getTemplates("email-templates")) as EmailTemplateRecord[] | null;
    return (
      templates?.find((template) => template.slug === slug && template.status === "active") ?? null
    );
  } catch {
    // A template read must never be the reason a password reset fails.
    return null;
  }
}

/** Escaped, then newlines become breaks — the bodies are plain text, not HTML. */
function toHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1f2937">${escaped
    .split("\n")
    .join("<br />")}</div>`;
}

/**
 * The shop's own details, for the variables every template may reference.
 *
 * `store_phone` and `store_email` are advertised to admins as insertable chips,
 * previewed with sample values, and used by two of the templates this repo
 * SHIPS — "out for delivery" says "Need help? Call {{store_phone}}" and the
 * invoice mail says "Questions? Email {{store_email}}". Only `store_name` was
 * ever merged, and `renderTemplate` leaves an unresolved key as literal text,
 * so customers received "Need help? Call {{store_phone}}".
 */
async function storeIdentity(): Promise<Record<string, string>> {
  const fallback = { store_name: "Our bakery", store_phone: "", store_email: "" };
  try {
    const settings = (await getSettings()) as {
      general?: GeneralSettings;
      contact?: ContactSettings;
    };
    return {
      store_name: settings.general?.siteName?.trim() || fallback.store_name,
      store_phone: settings.contact?.phone?.trim() ?? "",
      store_email: settings.contact?.email?.trim() ?? "",
    };
  } catch {
    return fallback;
  }
}

/**
 * The public origin, for links in an email.
 *
 * Emails are read outside the app, so a relative path is useless in one. Comes
 * from the SEO canonical base URL — the one place an admin already sets the
 * site's public address — with the env var as an override for deployments where
 * the two legitimately differ.
 */
export async function publicBaseUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv && isReachableOrigin(fromEnv)) return fromEnv.replace(/\/$/, "");

  try {
    const seo = (await getSiteLayout("seo")) as SeoStore | null;
    const base = seo?.global?.canonicalBaseUrl?.trim();
    if (base && isReachableOrigin(base)) return base.replace(/\/$/, "");
  } catch {
    // Fall through — a missing base URL must not stop the email going out.
  }

  return "";
}

/**
 * Whether an origin is one a customer's mail client could actually open.
 *
 * The SEO store SEEDS `canonicalBaseUrl` as "https://www.monginis.example", and
 * `.example` is reserved by RFC 2606 precisely so that it never resolves. Until
 * a shop edited its SEO settings or set NEXT_PUBLIC_SITE_URL, every order
 * confirmation therefore went out with a "view your invoice" link pointing at a
 * host that does not exist — the mail sent, the customer clicked, and nothing
 * happened. A dead link is worse than no link, because the caller's fallback
 * ("Reply to this email and we will send your invoice") is a sentence that
 * actually works.
 *
 * The other reserved names go with it for the same reason, and a bare hostname
 * with no scheme is rejected because a mail client will not linkify it.
 */
function isReachableOrigin(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  // RFC 2606 / RFC 6761 reserved — guaranteed never to resolve.
  return !/\.(example|invalid|test|localhost)$/.test(host) && host !== "localhost";
}

export async function sendTemplatedEmail(
  slug: EmailTemplateSlug,
  to: string,
  variables: Record<string, string>
): Promise<MailResult> {
  if (!to?.trim()) return { sent: false, error: "No recipient address on the record." };

  const stored = await findTemplate(slug);
  const source = stored ?? FALLBACKS[slug];

  // The store's own details are filled here rather than by every caller — they
  // are the same for all of them and read from settings the caller may not
  // have. A caller may still override any of them explicitly.
  const merged = { ...(await storeIdentity()), ...variables };

  const body = renderTemplate(source.body, merged);

  return sendMail({
    to: to.trim(),
    subject: renderTemplate(source.subject, merged),
    html: toHtml(body),
    text: body,
  });
}
