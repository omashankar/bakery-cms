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
    return Response.json(
      {
        error:
          "Razorpay is not connected. Add your keys in Admin → Payments → Payment Gateway (or .env.local).",
      },
      { status: 500 }
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
