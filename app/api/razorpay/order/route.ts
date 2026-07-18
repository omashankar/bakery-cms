import Razorpay from "razorpay";
import { getRazorpayCredentials } from "@/features/admin/settings/lib/razorpay-config.server";

/**
 * Creates a Razorpay order on the server.
 * The secret key never leaves the server. Amount comes in as rupees and is
 * converted to paise (Razorpay's smallest unit).
 */
export async function POST(request: Request) {
  const credentials = getRazorpayCredentials();
  if (!credentials) {
    // The customer sees this verbatim in the payment-failed dialog, so it must
    // read as help, not as a task for whoever runs the shop. The setup detail
    // belongs in the server log, where an operator will actually look.
    console.error(
      "[razorpay] No credentials. Set them in Admin → Payments → Payment Gateway, or via RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET."
    );
    return Response.json(
      {
        error:
          "Online payment is unavailable right now. Please choose Cash on Delivery, or try again shortly.",
      },
      { status: 503 }
    );
  }
  const { keyId, keySecret } = credentials;

  let body: { amount?: number; receipt?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: "Invalid amount" }, { status: 400 });
  }

  try {
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // rupees -> paise
      currency: "INR",
      receipt: body.receipt?.slice(0, 40) || `rcpt_${amount}`,
    });

    return Response.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId, // key_id is public and safe to expose to the client
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Razorpay order failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
