import { sendMail, type MailResult } from "@/lib/server/mail/send-mail";
import { renderTemplate } from "@/lib/template-render";
import { getSettings } from "@/features/settings/server/settings.service";
import { getSiteLayout } from "@/features/site-layout/server/site-layout.service";
import type { EmailTemplateRecord } from "@/types/communication";
import type { SeoStore } from "@/types/seo";
import type { GeneralSettings } from "@/types/settings";

import { getTemplates } from "./communications.service";

/**
 * Sends one of the admin's stored email templates.
 *
 * The templates already existed and were editable; nothing rendered or sent
 * them. This is the path that makes that page mean something: the copy an admin
 * writes is the copy the customer receives.
 */

/** The transactional templates this codebase actually triggers. */
export type EmailTemplateSlug = "order_confirmation" | "password_reset";

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

async function storeName(): Promise<string> {
  try {
    const settings = (await getSettings()) as { general?: GeneralSettings };
    return settings.general?.siteName?.trim() || "Our bakery";
  } catch {
    return "Our bakery";
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
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  try {
    const seo = (await getSiteLayout("seo")) as SeoStore | null;
    const base = seo?.global?.canonicalBaseUrl?.trim();
    if (base) return base.replace(/\/$/, "");
  } catch {
    // Fall through — a missing base URL must not stop the email going out.
  }

  return "";
}

export async function sendTemplatedEmail(
  slug: EmailTemplateSlug,
  to: string,
  variables: Record<string, string>
): Promise<MailResult> {
  if (!to?.trim()) return { sent: false, error: "No recipient address on the record." };

  const stored = await findTemplate(slug);
  const source = stored ?? FALLBACKS[slug];

  // `store_name` is filled here rather than by every caller — it is the same
  // value for all of them and reads from settings the caller may not have.
  const merged = { store_name: await storeName(), ...variables };

  const body = renderTemplate(source.body, merged);

  return sendMail({
    to: to.trim(),
    subject: renderTemplate(source.subject, merged),
    html: toHtml(body),
    text: body,
  });
}
