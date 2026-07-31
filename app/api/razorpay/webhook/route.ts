import { getRazorpayWebhookSecret } from "@/lib/server/payments/razorpay-credentials";
import { verifyWebhookSignature } from "@/features/payments/lib/webhook-signature";
import { findDraftByRazorpayOrder } from "@/features/checkout/server/draft.repository";
import * as orderService from "@/features/orders/server/order.service";

/**
 * Razorpay's own report that money moved.
 *
 * Every payment in this system used to depend on the customer's browser
 * surviving the round trip: the gateway told the browser, the browser told us.
 * A closed tab, a dead battery or a flaky network between the payment and the
 * confirmation left the shop with money in its Razorpay account and no order
 * anywhere — and nothing to reconcile against, because the gateway order id was
 * never stored on our side either.
 *
 * That got worse, not better, when placement began requiring a priced draft: the
 * draft sits there paid-for and unclaimed. So this is the other half of that
 * change, not a nicety.
 *
 * Set the URL and secret in the Razorpay dashboard, and either
 * `RAZORPAY_WEBHOOK_SECRET` or the admin's saved config here.
 */

/** The events that mean "this cart is paid for". */
const PAID_EVENTS = new Set(["payment.captured", "order.paid"]);

export async function POST(request: Request) {
  const secret = getRazorpayWebhookSecret();
  if (!secret) {
    // Refuse rather than trust: an unsigned webhook is an anonymous request that
    // creates paid orders. 503 so Razorpay retries once it is configured.
    console.error("[razorpay] Webhook received but no webhook secret is configured.");
    return Response.json({ error: "Webhook not configured" }, { status: 503 });
  }

  // The RAW body — the signature covers the exact bytes Razorpay sent, so
  // parsing and re-serialising would break it.
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(raw, signature, secret)) {
    console.error("[razorpay] Webhook signature did not verify — ignoring.");
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string; status?: string } } };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!event.event || !PAID_EVENTS.has(event.event)) {
    // Acknowledged, deliberately. Anything other than 2xx makes Razorpay retry
    // an event we are never going to act on.
    return Response.json({ ok: true, ignored: event.event ?? null });
  }

  const entity = event.payload?.payment?.entity;
  const paymentId = entity?.id;
  const razorpayOrderId = entity?.order_id;
  if (!paymentId || !razorpayOrderId) {
    return Response.json({ ok: true, ignored: "no payment entity" });
  }

  const draft = await findDraftByRazorpayOrder(razorpayOrderId);
  if (!draft) {
    // Expired, or a payment for something this shop did not open. Not an error
    // worth retrying — but worth an operator seeing, because it is money with no
    // cart behind it.
    console.error(
      `[razorpay] Captured payment ${paymentId} has no draft (gateway order ${razorpayOrderId}).`,
    );
    return Response.json({ ok: true, ignored: "no draft" });
  }

  if (draft.consumedByOrderId) {
    // The browser got there first. This is the ordinary case, not a problem.
    return Response.json({ ok: true, alreadyPlaced: draft.consumedByOrderId });
  }

  if (!draft.address) {
    // Quoted before the customer had entered an address, so there is nothing to
    // deliver to. Logged loudly: the money is real and someone has to act.
    console.error(
      `[razorpay] Captured payment ${paymentId} for draft ${draft.id} which has no delivery address — needs manual follow-up.`,
    );
    return Response.json({ ok: true, ignored: "draft has no address" });
  }

  try {
    // The same path the browser takes, so the payment is verified against the
    // draft, stock is reduced transactionally, the coupon is counted and the
    // confirmation email goes out — one implementation, not two.
    const order = await orderService.placeOrder(
      {
        draftId: draft.id,
        items: draft.items as never,
        totals: draft.totals as never,
        address: draft.address as never,
        paymentMethod: "razorpay",
        paymentReference: paymentId,
        deliverySlot: draft.deliverySlot as never,
        orderNotes: draft.orderNotes ?? undefined,
      },
      { ip: "razorpay-webhook", userAgent: "razorpay-webhook" },
    );

    console.info(`[razorpay] Webhook placed order ${order.orderNumber} for payment ${paymentId}.`);
    return Response.json({ ok: true, orderNumber: order.orderNumber });
  } catch (error) {
    // 500 so Razorpay retries. The draft is still unconsumed, and `placeOrder`
    // is idempotent on the draft, so a retry cannot double-place.
    console.error(`[razorpay] Webhook could not place the order: ${String(error)}`);
    return Response.json({ error: "Could not place order" }, { status: 500 });
  }
}
