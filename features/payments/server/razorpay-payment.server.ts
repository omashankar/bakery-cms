import Razorpay from "razorpay";

import { getRazorpayCredentials } from "@/lib/server/payments/razorpay-credentials";

/**
 * Asks Razorpay whether a payment reference is real and captured.
 *
 * Until now nothing on the server ever did. `/api/razorpay/verify` computed the
 * signature, returned `{verified}` to the BROWSER, and persisted nothing — so
 * the answer to "is this order paid?" was decided in the customer's browser and
 * `placeOrder` simply believed it. An anonymous POST with
 * `paymentMethod: "razorpay"` and no payment at all was stored as a confirmed,
 * paid order.
 *
 * This is the smallest check that does not require the storefront to change: the
 * client already sends the gateway's payment id as `paymentReference`, and the
 * gateway is the authority on whether it was captured.
 *
 * It is NOT the whole fix. The amount is still whatever the client put in the
 * cart, because the amount Razorpay was asked to charge is also chosen by the
 * client (`POST /api/razorpay/order` takes `amount` from the body). Closing that
 * needs the server to own the total before payment — a quote/draft step this
 * architecture does not have yet.
 */
export interface PaymentCheck {
  captured: boolean;
  /** What the gateway says was actually paid, in major units. */
  amount: number | null;
  /** The gateway order this payment settled — must be the cart's own. */
  orderId: string | null;
  /** Why we could not confirm — an operator problem, not a customer one. */
  unavailable?: string;
}

const NOT_CONFIRMED: PaymentCheck = { captured: false, amount: null, orderId: null };

export async function checkRazorpayPayment(paymentId: string): Promise<PaymentCheck> {
  const reference = paymentId.trim();
  if (!reference) return NOT_CONFIRMED;

  const credentials = getRazorpayCredentials();
  if (!credentials) {
    return { ...NOT_CONFIRMED, unavailable: "Razorpay credentials are not configured" };
  }

  try {
    const razorpay = new Razorpay({
      key_id: credentials.keyId,
      key_secret: credentials.keySecret,
    });
    const payment = await razorpay.payments.fetch(reference);

    // "captured" is the only state where the money has actually moved.
    // "authorized" is a hold that can still expire, and Razorpay's own docs
    // treat it as not yet collected.
    const captured = payment?.status === "captured";
    const paise = typeof payment?.amount === "number" ? payment.amount : Number(payment?.amount);

    return {
      captured,
      amount: Number.isFinite(paise) ? paise / 100 : null,
      orderId: typeof payment?.order_id === "string" ? payment.order_id : null,
    };
  } catch (error) {
    // Fail CLOSED on the payment status: an unreachable gateway must never
    // produce a "paid" order. Understating payment is recoverable by an
    // operator; overstating it is money the shop never receives.
    const message = error instanceof Error ? error.message : "Razorpay lookup failed";
    return { ...NOT_CONFIRMED, unavailable: message };
  }
}
