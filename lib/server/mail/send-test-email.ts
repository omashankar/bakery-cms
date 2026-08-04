import { sendMail, verifyMailConnection, type MailResult } from "./send-mail";

/**
 * Proves the saved SMTP settings work end to end: connect, authenticate, then
 * actually deliver a message.
 *
 * Verifying first is what makes the failure useful. Without it a wrong port and
 * a wrong password both surface as one opaque send error; with it, the connection
 * problem is reported as a connection problem.
 */
export async function sendTestEmail(to: string): Promise<MailResult> {
  const connection = await verifyMailConnection();
  if (!connection.sent) return connection;

  const sentAt = new Date().toUTCString();

  return sendMail({
    to,
    subject: "SMTP test — your settings work",
    html:
      `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1f2937">` +
      `<p>This is a test from your admin panel.</p>` +
      `<p>If you are reading it, the SMTP settings you saved are correct — order ` +
      `confirmations and password-reset codes will reach customers.</p>` +
      `<p style="color:#6b7280;font-size:13px">Sent ${sentAt}</p>` +
      `</div>`,
    text:
      "This is a test from your admin panel.\n\n" +
      "If you are reading it, the SMTP settings you saved are correct — order " +
      "confirmations and password-reset codes will reach customers.\n\n" +
      `Sent ${sentAt}`,
  });
}
