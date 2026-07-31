import Razorpay from "razorpay";
import { getRazorpayCredentials } from "@/lib/server/payments/razorpay-credentials";
import { attachRazorpayOrder, findDraft } from "@/features/checkout/server/draft.repository";

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

  let body: { draftId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  // It used to be `const amount = Number(body.amount)`. That single line was the
  // money hole: the customer chose what they would be charged, so a 5000-rupee
  // cart could be paid in full — genuinely, with a real captured payment — at 1
  // rupee, and every later check saw a legitimate payment for the amount asked.
  const draftId = (body.draftId ?? "").trim();
  if (!draftId) {
    return Response.json({ error: "Missing draftId" }, { status: 400 });
  }

  const draft = await findDraft(draftId);
  if (!draft) {
    // Expired or never existed. The cart has to be priced again — which is also
    // the right answer when prices have moved since it was quoted.
    return Response.json(
      { error: "This cart needs to be priced again. Please refresh and retry." },
      { status: 409 },
    );
  }
  if (draft.consumedByOrderId) {
    return Response.json({ error: "This cart has already been ordered." }, { status: 409 });
  }

  const amount = Number(draft.totals?.total);
  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: "This cart has no payable total." }, { status: 409 });
  }

  try {
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // rupees -> paise
      currency: "INR",
      // The draft id, so a gateway payment can be traced back to the cart it
      // was opened for. The old receipt was `rcpt_${amount}` and was stored
      // nowhere — the only link between a Razorpay order and this system, and
      // it was thrown away.
      receipt: draftId.slice(0, 40),
      notes: { draftId },
    });

    await attachRazorpayOrder(draftId, order.id);

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
