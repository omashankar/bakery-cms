import crypto from "node:crypto";
import { getRazorpayCredentials } from "@/lib/server/payments/razorpay-credentials";
import { timingSafeEquals } from "@/features/payments/lib/webhook-signature";

/**
 * Verifies a Razorpay payment signature server-side (HMAC-SHA256 with the secret
 * key). Only a genuine, completed payment produces a matching signature — this is
 * what confirms the payment is real before we mark the order as paid.
 */
export async function POST(request: Request) {
  const keySecret = (await getRazorpayCredentials())?.keySecret;
  if (!keySecret) {
    return Response.json(
      { verified: false, error: "Razorpay secret not configured" },
      { status: 500 }
    );
  }

  let body: {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ verified: false, error: "Invalid body" }, { status: 400 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  /**
   * TYPE-checked, not just truthiness-checked.
   *
   * The body is caller-controlled JSON, so any of these can arrive as a number,
   * an object or an array and still be truthy. `Buffer.from(<non-string>)`
   * throws ERR_INVALID_ARG_TYPE, and this handler has no error wrapper — so a
   * crafted body produced a 500 out of a public route instead of the
   * `{ verified: false }` the caller is meant to get. The guard beside it
   * already reasons about exactly this class for the signature's LENGTH.
   */
  if (
    typeof razorpay_order_id !== "string" ||
    typeof razorpay_payment_id !== "string" ||
    typeof razorpay_signature !== "string" ||
    !razorpay_order_id ||
    !razorpay_payment_id ||
    !razorpay_signature
  ) {
    return Response.json({ verified: false, error: "Missing fields" }, { status: 400 });
  }

  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  // Byte-safe: comparing `String.length` here let a crafted non-ASCII signature
  // through to `timingSafeEqual`, which throws on a length mismatch — a 500 in
  // the middle of a checkout that has already been charged.
  const verified = timingSafeEquals(expected, razorpay_signature);

  return Response.json({ verified, paymentId: verified ? razorpay_payment_id : null });
}
