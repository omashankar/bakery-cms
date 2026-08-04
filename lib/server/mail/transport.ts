import nodemailer, { type Transporter } from "nodemailer";

import { getSettings } from "@/features/settings/server/settings.service";
import type { SmtpSettings } from "@/types/settings";

/**
 * The mail transport, built from the SMTP settings an admin saved.
 *
 * Those settings had a whole page and were stored durably, but nothing read
 * them — there was no mail dependency and no send path, so "Send test email"
 * said "demo, no backend connected" and a password-reset code went to the server
 * log instead of the customer. This is the missing half.
 *
 * Deliberately reads the SAVED settings rather than environment variables: the
 * admin owns this configuration through the UI, and an env-only transport would
 * make that page decoration again.
 */

/** Why a send could not be attempted. Distinguished so callers can say which. */
export type MailUnavailableReason = "disabled" | "incomplete";

export interface MailTransport {
  transporter: Transporter;
  from: string;
}

export type TransportResult =
  | { ok: true; transport: MailTransport }
  | { ok: false; reason: MailUnavailableReason };

/**
 * Everything a send genuinely cannot proceed without.
 *
 * `password` is NOT required: an internal relay on a trusted network, or a local
 * MailHog/Mailpit in development, legitimately takes none. Requiring it would
 * reject working configurations.
 */
function isComplete(smtp: SmtpSettings): boolean {
  return Boolean(smtp.host?.trim() && smtp.port > 0 && smtp.fromEmail?.trim());
}

/** Quoted so a display name containing a comma cannot split the header. */
function formatFrom(smtp: SmtpSettings): string {
  const name = smtp.fromName?.trim();
  return name ? `"${name.replace(/"/g, "")}" <${smtp.fromEmail}>` : smtp.fromEmail;
}

/**
 * Identifies a configuration WITHOUT its password, so the cache key never
 * carries a credential and a settings change still invalidates it.
 */
function fingerprint(smtp: SmtpSettings): string {
  return [
    smtp.host,
    smtp.port,
    smtp.username,
    smtp.encryption,
    smtp.fromEmail,
    smtp.fromName,
    // Length only — enough to notice a rotation, useless to anyone reading it.
    smtp.password?.length ?? 0,
  ].join("|");
}

let cached: { key: string; transport: MailTransport } | null = null;

function build(smtp: SmtpSettings): MailTransport {
  const secure = smtp.encryption === "ssl";

  const transporter = nodemailer.createTransport({
    host: smtp.host.trim(),
    port: smtp.port,
    // `secure` means TLS from the first byte, which is port 465. On 587 the
    // connection starts plain and upgrades via STARTTLS, so `secure` must be
    // false there or the handshake hangs — the single most common way an
    // otherwise-correct SMTP config appears broken.
    secure,
    requireTLS: smtp.encryption === "tls",
    // "None" has to actually mean none. Without this nodemailer still upgrades
    // opportunistically whenever the server advertises STARTTLS, so an admin who
    // picked "None" — which in practice means a local relay, Mailpit, or an
    // internal host with a self-signed certificate — got a TLS handshake anyway
    // and a certificate error they had explicitly asked to avoid.
    ignoreTLS: smtp.encryption === "none",
    auth: smtp.password ? { user: smtp.username, pass: smtp.password } : undefined,
    // A queued admin action must not hold a request open indefinitely.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  return { transporter, from: formatFrom(smtp) };
}

/**
 * The transport for the current settings, or why there isn't one.
 *
 * Cached across requests because building one opens no socket, but a settings
 * change must take effect immediately — hence the fingerprint rather than a
 * plain "built once" flag.
 */
export async function getMailTransport(): Promise<TransportResult> {
  const settings = (await getSettings()) as { smtp?: SmtpSettings };
  const smtp = settings.smtp;

  if (!smtp?.enabled) return { ok: false, reason: "disabled" };
  if (!isComplete(smtp)) return { ok: false, reason: "incomplete" };

  const key = fingerprint(smtp);
  if (cached?.key === key) return { ok: true, transport: cached.transport };

  const transport = build(smtp);
  cached = { key, transport };
  return { ok: true, transport };
}

/** Drops the cached transport. Called when the SMTP section is written. */
export function resetMailTransport(): void {
  cached = null;
}

export function describeUnavailable(reason: MailUnavailableReason): string {
  return reason === "disabled"
    ? "Email sending is turned off in Settings → SMTP."
    : "SMTP is incomplete — a host, port and from-address are required.";
}
