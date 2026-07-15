import crypto from "node:crypto";
import { getRazorpayCredentials } from "@/features/admin/settings/lib/razorpay-config.server";

/**
 * Verifies a Razorpay payment signature server-side (HMAC-SHA256 with the secret
 * key). Only a genuine, completed payment produces a matching signature — this is
 * what confirms the payment is real before we mark the order as paid.
 */
export async function POST(request: Request) {
  const keySecret = getRazorpayCredentials()?.keySecret;
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
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return Response.json({ verified: false, error: "Missing fields" }, { status: 400 });
  }

  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const verified =
    expected.length === razorpay_signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));

  return Response.json({ verified, paymentId: verified ? razorpay_payment_id : null });
}
