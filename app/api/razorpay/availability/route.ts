import { getSiteIdentity } from "@/features/settings/server/site-identity.server";
import { isRazorpayChargeable } from "@/features/payments/lib/razorpay-currency";
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
  const { currency } = await getSiteIdentity();

  /**
   * The shop's CURRENCY decides this as much as the keys do.
   *
   * Razorpay is charged in one currency here, and Settings → General offers
   * three others. Asking up front is the same reasoning that already applies to
   * missing keys, and for the same reason: offering "Pay Online" and refusing at
   * the final click means the customer filled in an address, chose a slot and
   * pressed Pay before finding out.
   *
   * Reported as `configured: false` rather than as a new field the caller might
   * not read. Checkout's rule is "hide the option unless the server says yes",
   * and a shop whose currency this gateway cannot take is a shop where online
   * payment is not available — which is exactly what that flag means.
   */
  const chargeable = isRazorpayChargeable(currency);

  return Response.json({
    configured: status.configured && chargeable,
    testMode: status.testMode,
    // Separated so the ADMIN can tell "no keys" from "wrong currency" — the two
    // need completely different things done about them, and the storefront
    // simply does not offer the option either way.
    currencySupported: chargeable,
    currency,
  });
}
