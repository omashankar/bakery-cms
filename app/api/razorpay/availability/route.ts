import { getRazorpayStatus } from "@/lib/server/payments/razorpay-credentials";

/**
 * Can this shop take an online payment right now?
 *
 * Public on purpose — the storefront checkout has to know whether to offer the
 * Razorpay option or fall back to cash on delivery, and the demo notice has to
 * know whether the shop is in test mode.
 *
 * Deliberately narrow. `/api/razorpay/config` answers the same question with the
 * live key id, the source of the keys and whether a webhook secret is set
 * attached; that endpoint is admin-only, and this exists so making it so did not
 * take the checkout down with it. Nothing here identifies the account.
 */
export async function GET() {
  const status = await getRazorpayStatus();
  return Response.json({ configured: status.configured, testMode: status.testMode });
}
