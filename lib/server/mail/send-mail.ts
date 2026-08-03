import {
  describeUnavailable,
  getMailTransport,
  type MailUnavailableReason,
} from "./transport";

/**
 * Sending one email. Never throws.
 *
 * `sent` is the only honest basis for telling anyone an email went out. Callers
 * that report to a user must use it — the whole reason this module exists is
 * that the app used to claim delivery it had never attempted.
 */
export interface MailResult {
  sent: boolean;
  /** Present when `sent` is false: something an admin can act on. */
  error?: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  /** Rendered HTML body. */
  html: string;
  /** Plain-text alternative. Derived from the HTML when omitted. */
  text?: string;
  replyTo?: string;
}

/**
 * A readable plain-text fallback, so the message is not blank in a text-only
 * client and scores better with spam filters.
 */
function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Never let a provider's error text carry a credential into a log or a toast. */
function scrub(message: string, secrets: string[]): string {
  return secrets.reduce(
    (text, secret) => (secret ? text.split(secret).join("***") : text),
    message
  );
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  // Held outside the try so the catch can still scrub with it, whether the
  // throw came from the settings read or from the send.
  let authPassword = "";

  try {
    // INSIDE the try. `getMailTransport` reads the settings from Mongo, so it
    // rejects whenever the database is unreachable — and this function's own
    // contract says it never throws. It sat outside, so a Mongo blip during
    // checkout threw out of the confirmation email and into the order-placement
    // request, turning "the customer did not get an email" into "the order
    // failed" for an order that had already been paid for and stored.
    const result = await getMailTransport();
    if (!result.ok) {
      return { sent: false, error: describeUnavailable(result.reason as MailUnavailableReason) };
    }

    const { transporter, from } = result.transport;
    authPassword =
      (transporter.options as { auth?: { pass?: string } }).auth?.pass ?? "";

    await transporter.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text ?? toPlainText(message.html),
      replyTo: message.replyTo,
    });
    return { sent: true };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "The mail server rejected the message.";
    // The auth password can appear verbatim in a nodemailer auth failure.
    const safe = scrub(raw, [authPassword]);

    console.error(`[mail] send failed: ${safe}`);
    return { sent: false, error: safe };
  }
}

/**
 * Proves the saved settings actually work, by talking to the server rather than
 * inspecting the config. Used by "Send test email", which previously reported
 * success without a network call of any kind.
 */
export async function verifyMailConnection(): Promise<MailResult> {
  // Same reasoning as `sendMail`: the settings read is I/O and can reject, and
  // this is the function behind a button an admin presses to DIAGNOSE a problem.
  // Throwing a raw database error at them from a connection test is the least
  // useful moment for it.
  let authPassword = "";

  try {
    const result = await getMailTransport();
    if (!result.ok) {
      return { sent: false, error: describeUnavailable(result.reason as MailUnavailableReason) };
    }

    authPassword =
      (result.transport.transporter.options as { auth?: { pass?: string } }).auth?.pass ?? "";

    await result.transport.transporter.verify();
    return { sent: true };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Could not reach the mail server.";
    return { sent: false, error: scrub(raw, [authPassword]) };
  }
}
