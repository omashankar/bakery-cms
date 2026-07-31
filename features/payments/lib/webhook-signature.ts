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

  // Length is checked first because `timingSafeEqual` THROWS on a length
  // mismatch rather than returning false — an unhandled throw here would be a
  // 500, which Razorpay retries forever.
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
