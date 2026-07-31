import crypto from "node:crypto";

/**
 * Whether a webhook body really came from Razorpay.
 *
 * Pure and separate from the route so it can be tested without a request: this
 * one boolean is the entire authentication of an endpoint that creates PAID
 * orders. If it is wrong in either direction the damage is severe — too strict
 * and real payments never become orders, too loose and anyone can post one.
 */
export function verifyWebhookSignature(
  /** The RAW bytes as received. Re-serialised JSON will not match. */
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeEquals(expected, signature);
}

/**
 * Constant-time string comparison that cannot throw.
 *
 * `crypto.timingSafeEqual` THROWS on a length mismatch rather than returning
 * false, so the length has to be checked first — and it has to be the BYTE
 * length. Guarding on `String.length` looks equivalent and is not: 64 non-ASCII
 * characters have the same `.length` as a 64-character hex digest but twice the
 * bytes, so a crafted header sailed past the guard and into the throw. That is a
 * 500 on an endpoint Razorpay retries, and on the payment-verification endpoint
 * the storefront calls mid-checkout.
 *
 * Exported so both signature checks in this codebase share one implementation
 * rather than each carrying its own copy of the subtlety.
 */
export function timingSafeEquals(expected: string, given: string): boolean {
  const expectedBytes = Buffer.from(expected, "utf8");
  const givenBytes = Buffer.from(given, "utf8");
  if (expectedBytes.length !== givenBytes.length) return false;
  return crypto.timingSafeEqual(expectedBytes, givenBytes);
}
