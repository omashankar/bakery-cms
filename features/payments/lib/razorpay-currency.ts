/**
 * The one currency this shop's Razorpay integration can charge.
 *
 * Razorpay itself supports many, but only for an account that has international
 * payments enabled — a setting on Razorpay's side that this code cannot see or
 * check. Everything here is also built for a single minor unit of 1/100, which
 * holds for INR, USD, EUR and GBP but not for every currency Razorpay lists.
 *
 * So this is deliberately a constant rather than a lookup: the honest position
 * is "charge exactly what the shop quoted, and if the gateway is not wired for
 * that, refuse". Widening it means proving the account can take the currency,
 * not adding a string here.
 */
export const RAZORPAY_CURRENCY = "INR";

/**
 * Can an online payment be taken in this shop's currency?
 *
 * Admin → Settings → General offers USD, EUR and GBP alongside INR, and every
 * price the customer sees is formatted in whichever is set. The Razorpay order
 * was created with a hard-coded "INR" regardless — so a shop on USD displayed
 * "$1,200.00" and the gateway was asked for ₹1,200, roughly a fourteenth of it,
 * while the order recorded the amount the customer was never charged.
 *
 * Case-insensitive and trimmed because this value comes from a settings
 * document that predates the Zod enum constraining it.
 */
export function isRazorpayChargeable(currency: string | undefined | null): boolean {
  return (currency ?? "").trim().toUpperCase() === RAZORPAY_CURRENCY;
}
