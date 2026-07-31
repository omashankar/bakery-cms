import { getRazorpayWebhookSecret } from "@/lib/server/payments/razorpay-credentials";
import { verifyWebhookSignature } from "@/features/payments/lib/webhook-signature";
import { findDraftByRazorpayOrder } from "@/features/checkout/server/draft.repository";
import { recordUnclaimedPayment } from "@/features/payments/server/unclaimed-payment.repository";
import * as orderService from "@/features/orders/server/order.service";

/**
 * Razorpay's own report of what happened to money.
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
 * It carries three jobs, and the second and third are as important as the first:
 *
 *  1. Place the order when the browser could not.
 *  2. Correct an order the browser DID place but whose payment we failed to
 *     confirm at the time. That lookup fails closed, so a momentary blip stored
 *     a genuinely captured payment as `pending` — and nothing ever asked again.
 *     This is the only component that later hears the truth.
 *  3. Settle refunds. A gateway refund is created `pending` and becomes
 *     `processed` (or `failed`) minutes to days later, at the bank's pace.
 *
 * Set the URL and secret in the Razorpay dashboard, and the secret here (Admin →
 * Payments → Payment Gateway) or as `RAZORPAY_WEBHOOK_SECRET`.
 */

/** The events that mean "this cart is paid for". */
const PAID_EVENTS = new Set(["payment.captured", "order.paid"]);
/** The events that mean "a refund we asked for has settled, one way or the other". */
const REFUND_EVENTS = new Set(["refund.processed", "refund.failed"]);

interface PaymentEntity {
  id?: string;
  order_id?: string;
  status?: string;
  amount?: number | string;
  email?: string;
  contact?: string;
}

interface RefundEntity {
  id?: string;
  payment_id?: string;
  status?: string;
  amount?: number | string;
}

interface WebhookEvent {
  event?: string;
  payload?: {
    payment?: { entity?: PaymentEntity };
    refund?: { entity?: RefundEntity };
  };
}

/** Major units from the gateway's paise. */
function toMajor(value: unknown): number {
  const paise = typeof value === "number" ? value : Number(value);
  return Number.isFinite(paise) ? paise / 100 : 0;
}

export async function POST(request: Request) {
  const secret = await getRazorpayWebhookSecret();
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

  let event: WebhookEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  if (event.event && REFUND_EVENTS.has(event.event)) {
    return handleRefundEvent(event);
  }

  if (!event.event || !PAID_EVENTS.has(event.event)) {
    // Acknowledged, deliberately. Anything other than 2xx makes Razorpay retry
    // an event we are never going to act on.
    return Response.json({ ok: true, ignored: event.event ?? null });
  }

  return handlePaidEvent(event);
}

async function handlePaidEvent(event: WebhookEvent) {
  const entity = event.payload?.payment?.entity;
  const paymentId = entity?.id;
  const razorpayOrderId = entity?.order_id;
  if (!paymentId || !razorpayOrderId) {
    return Response.json({ ok: true, ignored: "no payment entity" });
  }

  const amount = toMajor(entity?.amount);

  // Did this payment already become an order?
  //
  // Asked FIRST, because the draft is the wrong thing to reason from once it has
  // expired. Drafts are removed by a TTL index 30 minutes after creation and
  // Razorpay redelivers for hours, so a perfectly successful order routinely has
  // no draft left by the time a later delivery arrives — and reading that as
  // "the money never became an order" filed a false alarm against a customer who
  // had their cake. The payment reference is what identifies the money.
  const placedAlready = await orderService.findOrderByPayment(paymentId);
  if (placedAlready) {
    const corrected = await orderService.confirmGatewayPayment(placedAlready.id, paymentId, amount);
    return Response.json({ ok: true, alreadyPlaced: placedAlready.id, corrected });
  }

  const draft = await findDraftByRazorpayOrder(razorpayOrderId);
  if (!draft) {
    // Expired, or a payment for a gateway order this shop has no record of
    // opening. Drafts live 30 minutes and Razorpay redelivers for hours, so a
    // retry that finally gets through can easily land here.
    //
    // A 200 stops the retries, which is right — no later delivery will conjure
    // the draft back. But that used to be the END of it: money in the account,
    // no order, and a console line nobody reads. It is written down instead, so
    // it shows up as outstanding rather than as a payment that never happened.
    await recordUnclaimedPayment({
      paymentId,
      gatewayOrderId: razorpayOrderId,
      amount,
      reason: "The priced cart had expired by the time the payment was confirmed.",
      customerEmail: entity?.email ?? null,
      customerPhone: entity?.contact ?? null,
    });
    console.error(
      `[razorpay] Captured payment ${paymentId} has no draft (gateway order ${razorpayOrderId}) — recorded as unclaimed.`,
    );
    return Response.json({ ok: true, ignored: "no draft" });
  }

  if (draft.consumedByOrderId) {
    // Claimed — but by an order that, per the check above, does not carry this
    // payment. Either the claimer is still inside its transaction, or it died
    // before inserting and the cart is stranded.
    //
    // Answering 200 here is what made that permanent: a 2xx stops Razorpay
    // retrying, and this handler is the only actor left once the browser has
    // gone. 500 instead, so the next delivery tries again — by which time the
    // claimer has either committed (and the lookup above finds it) or aged past
    // the claim grace, letting placement reclaim the draft.
    console.error(
      `[razorpay] Draft ${draft.id} is claimed by order ${draft.consumedByOrderId}, which does not carry payment ${paymentId}. Retrying.`,
    );
    await recordUnclaimedPayment({
      paymentId,
      gatewayOrderId: razorpayOrderId,
      amount,
      draftId: draft.id,
      reason: "Paid, but the order that claimed this cart was never completed.",
      customerName: (draft.address?.fullName as string) ?? null,
      customerEmail: (draft.address?.email as string) ?? entity?.email ?? null,
      customerPhone: (draft.address?.phone as string) ?? entity?.contact ?? null,
    });
    return Response.json({ error: "Cart claimed but not placed" }, { status: 500 });
  }

  if (!draft.address) {
    // Quoted before the customer had entered an address, so there is nothing to
    // deliver to. The money is real and someone has to act on it.
    await recordUnclaimedPayment({
      paymentId,
      gatewayOrderId: razorpayOrderId,
      amount,
      draftId: draft.id,
      reason: "Paid before a delivery address was entered, so no order could be created.",
      customerEmail: entity?.email ?? null,
      customerPhone: entity?.contact ?? null,
    });
    console.error(
      `[razorpay] Captured payment ${paymentId} for draft ${draft.id} has no delivery address — recorded as unclaimed.`,
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
    // 500 so Razorpay retries. The draft is still unconsumed (placement releases
    // its claim on failure) and `placeOrder` is idempotent on the draft, so a
    // retry cannot double-place.
    //
    // Retries do not last forever, though, and this is real money. Record it
    // now; if a later retry succeeds the row is resolved, and if none does an
    // operator still finds it.
    await recordUnclaimedPayment({
      paymentId,
      gatewayOrderId: razorpayOrderId,
      amount,
      draftId: draft.id,
      reason: `The order could not be created: ${String(error)}`,
      customerName: (draft.address?.fullName as string) ?? null,
      customerEmail: (draft.address?.email as string) ?? null,
      customerPhone: (draft.address?.phone as string) ?? null,
    });
    console.error(`[razorpay] Webhook could not place the order: ${String(error)}`);
    return Response.json({ error: "Could not place order" }, { status: 500 });
  }
}

/**
 * A refund we asked for has reached its end state.
 *
 * Until this arrives the refund record sits at `processing`, which is the honest
 * description of a refund the gateway has accepted but not yet paid out. This is
 * where it becomes `completed` — or `rejected`, when the bank sends it back.
 */
async function handleRefundEvent(event: WebhookEvent) {
  const entity = event.payload?.refund?.entity;
  const refundId = entity?.id;
  const paymentId = entity?.payment_id;
  if (!refundId || !paymentId) {
    return Response.json({ ok: true, ignored: "no refund entity" });
  }

  const settled = await orderService.settleGatewayRefund({
    refundId,
    paymentId,
    amount: toMajor(entity?.amount),
    status: event.event === "refund.failed" ? "failed" : "processed",
  });

  if (!settled) {
    // A refund for a payment we cannot find an order for, or one this order has
    // no record of asking for. The second case matters: it is how a refund that
    // left the gateway but never reached our database (a crash between the two)
    // gets recorded at all.
    console.error(
      `[razorpay] Refund ${refundId} for payment ${paymentId} could not be matched to an order.`,
    );
    return Response.json({ ok: true, ignored: "no matching order" });
  }

  return Response.json({ ok: true, refundId, settled });
}
