import { randomUUID } from "node:crypto";

import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { AppError, NotFoundError } from "@/lib/server/http/errors";
import { getSettings } from "@/features/settings/server/settings.service";
import * as productRepo from "@/features/products/server/product.repository";
import { deriveStockStatus } from "@/apps/admin/commerce/lib/inventory-utils";
import type { CommerceSettings, GeneralSettings } from "@/types/settings";
import type { GatewayRefund, RefundRecord } from "@/types/refund";
import {
  deriveRefundStatus,
  isFullyRefunded,
  planRefund,
  totalRefunded,
} from "@/features/orders/lib/refund-planning";
import {
  createRazorpayRefund,
  fetchRazorpayRefund,
  getRefundableAmount,
} from "@/features/payments/server/razorpay-refund.server";
import { resolveUnclaimedPayment } from "@/features/payments/server/unclaimed-payment.repository";
import { verifyOrderLookup } from "@/features/orders/lib/order-tracking";
import { orderStatusTransitionError } from "@/features/orders/lib/order-status-meta";
import { isBeforeLeadTime } from "@/features/orders/lib/delivery-date";
import { checkMinimumOrder } from "@/features/checkout/lib/minimum-order";
import {
  priceCart,
  UnknownProductError,
  UnknownWeightError,
} from "@/features/checkout/server/pricing.server";
import {
  publicBaseUrl,
  sendTemplatedEmail,
} from "@/features/communications/server/email.service";
import { notifyWhatsApp } from "@/features/communications/server/whatsapp.service";
import { isNotificationEnabled } from "@/features/payments/server/notification-prefs.server";
import { routes } from "@/constants/routes";
import { formatCurrency } from "@/utils/format";
import { checkRazorpayPayment } from "@/features/payments/server/razorpay-payment.server";
import {
  consumeDraft,
  findDraft,
  reclaimDraft,
  releaseDraft,
} from "@/features/checkout/server/draft.repository";
import {
  decrementCouponUsage as releaseCouponRedemption,
  incrementCouponUsage as recordCouponRedemption,
} from "@/features/commerce/server/commerce.repository";
import type { PlacedOrder, OrderStatus, PaymentStatus } from "@/features/orders/lib/orders";

import * as repo from "./order.repository";
import type {
  PlaceOrderInput,
  RefundInput,
  RefundNotesInput,
  RefundRequestInput,
} from "./order.validators";

interface RequestCtx {
  ip: string;
  userAgent: string;
  actorId?: string | null;
  actorEmail?: string;
}

// ---- Order number + estimated delivery ------------------------------------

async function generateOrderNumber(commerce: CommerceSettings): Promise<string> {
  const prefix = commerce.orderNumberPrefix?.trim() || "BK";
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = String(Math.floor(Math.random() * 9000) + 1000);
    const candidate = `${prefix}-${stamp}-${suffix}`;
    if (!(await repo.orderNumberExists(candidate))) return candidate;
  }
  return `${prefix}-${stamp}-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * When the shop promises to deliver.
 *
 * The lead time comes from the DRAFT's totals when there is one — the numbers
 * the shop computed from its own zones — not from `input.totals`. That object is
 * `.passthrough()`, so `estimatedDeliveryDays` arrived straight from the caller
 * and was used verbatim: a request could ask for `0` and be promised same-day
 * delivery on a zone the shop had configured for five. Every other figure on the
 * order was taken back from the client; this one was still being handed over.
 */
function resolveEstimatedDelivery(
  input: PlaceOrderInput,
  commerce: CommerceSettings,
  draftTotals?: Record<string, unknown> | null,
): string {
  const slotDate = input.deliverySlot?.date;
  if (slotDate) {
    const chosen = new Date(slotDate);
    if (!Number.isNaN(chosen.getTime())) return chosen.toISOString();
  }

  const quoted = draftTotals?.estimatedDeliveryDays;
  const days =
    typeof quoted === "number"
      ? quoted
      : // No draft: a headless COD caller that never quoted. Fall back to the
        // shop's own setting rather than to anything the request supplied.
        commerce.estimatedDeliveryDays;

  const date = new Date();
  date.setDate(date.getDate() + Math.max(days ?? 1, 0));
  return date.toISOString();
}

// ---- Place order (transactional) ------------------------------------------

/**
 * Prices a cart that arrived WITHOUT a draft, from the shop's own records.
 *
 * Everything the caller chose is kept; nothing the caller costed is. Gift wrap
 * is inferred from the fee it claimed rather than trusted as an amount, and the
 * coupon is re-resolved from a code — the request's `coupon` object used to be
 * stored whole, discount included, and then counted in the coupon report.
 *
 * `UnknownProductError` becomes a 409 for the same reason the quote endpoint
 * does it: a slug the catalogue does not have means the cart and the shop
 * disagree, and pricing it at zero is how a shop gives away a deleted cake.
 */
async function repriceForPlacement(input: PlaceOrderInput) {
  const claimedCoupon = input.coupon as { code?: unknown } | undefined;
  const couponCode = typeof claimedCoupon?.code === "string" ? claimedCoupon.code : undefined;

  try {
    const quote = await priceCart({
      items: input.items.map((item) => {
        const line = item as unknown as Record<string, unknown>;
        return {
          productSlug: item.productSlug,
          quantity: item.quantity,
          weight: typeof line.weight === "string" ? line.weight : undefined,
          flavour: typeof line.flavour === "string" ? line.flavour : undefined,
          shape: typeof line.shape === "string" ? line.shape : undefined,
          message: typeof line.message === "string" ? line.message : undefined,
          deliveryDate: typeof line.deliveryDate === "string" ? line.deliveryDate : undefined,
          deliveryTime: typeof line.deliveryTime === "string" ? line.deliveryTime : undefined,
          variantSelections:
            line.variantSelections && typeof line.variantSelections === "object"
              ? (line.variantSelections as Record<string, string>)
              : undefined,
        };
      }),
      couponCode,
      giftWrap: Number((input.totals as { giftWrapFee?: unknown } | undefined)?.giftWrapFee) > 0,
      deliveryAddress: input.address
        ? { city: input.address.city, pincode: input.address.pincode }
        : undefined,
    });

    return { items: quote.items, totals: quote.totals, coupon: quote.coupon };
  } catch (error) {
    if (error instanceof UnknownProductError) {
      throw new AppError("One of the items is no longer available.", 409);
    }
    // A size the shop does not sell. Refused for the same reason a missing slug
    // is: the alternative is charging the smallest tier's price for whatever
    // size the line still says, and then baking that size.
    if (error instanceof UnknownWeightError) {
      throw new AppError("One of the items is no longer available in that size.", 409);
    }
    throw error;
  }
}

/** Fresh order numbers to try when the client's collided with another customer's. */
const ORDER_NUMBER_ATTEMPTS = 5;

export async function placeOrder(input: PlaceOrderInput, ctx: RequestCtx): Promise<PlacedOrder> {
  // ONE PAYMENT, ONE ORDER — checked before anything is built.
  //
  // The id-based idempotency below only catches a retry that kept its id. This
  // catches the cases that cannot: a client that lost its local copy and
  // re-submitted, a reload followed by a fresh checkout of the same cart, or a
  // retry path that minted a new id. A captured payment reference identifies the
  // money, and the money is what must not be charged for twice.
  if (input.paymentReference) {
    const existing = await repo.findByPaymentReference(input.paymentReference);
    if (existing) {
      // Same reasoning as the `already-placed` branch below, which has had this
      // guard from the start — this one was missed. The endpoint is deliberately
      // unauthenticated, so returning a stored order keyed on a client-supplied
      // string hands a stranger's name, phone, street address and every line
      // item to anyone who guesses a reference. A genuine retry always carries
      // the contact details it was placed with.
      if (!verifyOrderLookup(existing, input.address)) {
        throw new NotFoundError("Order not found");
      }
      return existing;
    }
  }

  const settings = (await getSettings()) as Record<string, unknown>;
  const commerce = (settings.commerce ?? {}) as CommerceSettings;
  // Passed explicitly to `formatCurrency` below: this runs in a route handler,
  // which never renders the root layout, so there is no `<html>` and no
  // per-request locale for the formatter to fall back on.
  const currency = ((settings.general ?? {}) as GeneralSettings).currency;
  const placedAt = new Date().toISOString();

  // The priced cart the shop holds. When there is one, its numbers ARE the
  // order's — `input.items[].price`, `input.totals` and `input.coupon` are
  // ignored. They used to be stored verbatim, so a 5000-rupee cake could be
  // ordered at 1 rupee and a coupon could be invented outright.
  const draft = input.draftId ? await findDraft(input.draftId) : null;
  if (input.draftId && !draft) {
    throw new AppError("This cart needs to be priced again. Please refresh and retry.", 409);
  }
  if (draft?.consumedByOrderId) {
    // Already spent. Fall through to the id-based idempotent path rather than
    // creating a second order for one payment.
    const existing = await repo.findById(draft.consumedByOrderId);
    if (existing) {
      if (!verifyOrderLookup(existing, input.address)) throw new NotFoundError("Order not found");
      return existing;
    }
  }

  // The order must go where the quote was priced FOR.
  //
  // The draft's totals are used verbatim, and the delivery charge inside them
  // depends entirely on the city and pincode. Taking `input.address` without
  // checking it against the address the draft was priced for meant a caller
  // could quote for the cheapest zone and then place the order somewhere else
  // and be charged the cheap zone's fee — the same hole as choosing your own
  // price, one field along.
  //
  // Only city and pincode are compared, because only those two decide the zone;
  // correcting a flat number or a landmark must not force a re-quote.
  // A draft priced with NO address is not a price for this address.
  //
  // The guard below only ran when the draft had one, so a caller could quote
  // with the address omitted — which prices at the fallback fee, or free — and
  // then place the order anywhere. The missing case was the cheap one.
  if (draft && !draft.deliveryAddress && input.address) {
    throw new AppError(
      "This cart was priced before a delivery address was entered. Please refresh so the delivery charge can be calculated.",
      409,
    );
  }

  if (draft?.deliveryAddress && input.address) {
    const priced = draft.deliveryAddress;
    const sameCity =
      (priced.city ?? "").trim().toLowerCase() === input.address.city.trim().toLowerCase();
    const samePincode =
      (priced.pincode ?? "").replace(/\D/g, "") === input.address.pincode.replace(/\D/g, "");

    if (!sameCity || !samePincode) {
      throw new AppError(
        "The delivery address has changed since this cart was priced. Please refresh so the delivery charge can be recalculated.",
        409,
      );
    }
  }

  // What this order COSTS, decided here in every case.
  //
  // `draft?.items ?? input.items` and `draft?.totals ?? input.totals` used to
  // stand in for this, and the `??` was the hole: a draft is only REQUIRED for
  // an online payment (below), so a plain anonymous POST with
  // `paymentMethod: "cod"` and no `draftId` fell through to the request body and
  // had its own subtotal, its own tax and its own total stored verbatim. The
  // previous pass closed this for anything that pays a gateway and left the cash
  // door open — but COD is the one where a wrong total is collected in cash at
  // the customer's doorstep, so it is the one that costs the shop real money.
  //
  // A headless COD caller may still place an order without quoting first. It
  // just does not get to say what the goods cost: the same `priceCart` the quote
  // endpoint uses re-prices the cart from the shop's own catalogue and settings.
  // The caller keeps every CHOICE it sent — slug, quantity, weight, variants,
  // gift wrap, coupon code — and none of the arithmetic.
  const priced = draft
    ? { items: draft.items, totals: draft.totals, coupon: draft.coupon }
    : await repriceForPlacement(input);

  // A date the shop can actually bake for.
  //
  // The zone's minimum lead time was collected, stored, displayed — and enforced
  // nowhere. The checkout's date picker floors on the shop-wide
  // `deliveryLeadDays`, which knows nothing about zones, and `min` on an input
  // is a suggestion to a browser rather than a rule. So a five-day zone accepted
  // tomorrow, and a direct POST accepted today.
  const leadDays = Number((priced.totals as { deliveryMinDays?: number } | undefined)?.deliveryMinDays);
  if (input.deliverySlot?.date && isBeforeLeadTime(input.deliverySlot.date, leadDays)) {
    throw new AppError(
      `We need ${leadDays} day${leadDays === 1 ? "" : "s"} to prepare an order for this area. Please choose a later delivery date.`,
      409,
    );
  }

  // The shop's minimum order value, enforced by the shop.
  //
  // It was configured on two admin screens and checked in exactly one place —
  // the browser. `checkout-page.tsx` greys out the Pay button and toasts; the
  // server had never heard of the setting, so any direct POST placed an order
  // under it, and so did the storefront with one value edited in devtools.
  //
  // Checked against the SUBTOTAL, and against the shop's own subtotal now that
  // `priced` is authoritative — clearing a minimum by inflating the delivery fee
  // would defeat what the minimum is for.
  //
  // Only for a cart that was never quoted. With a draft, the quote endpoint
  // already refused a below-minimum cart — and re-checking here would refuse an
  // order the shop had ALREADY opened a gateway payment against, so an admin
  // raising the minimum between the quote and the callback would strand a
  // customer whose card had just been captured. The minimum decides whether to
  // take an order, not whether to honour one already paid for.
  const minimum = draft
    ? { below: false, shortfall: 0 }
    : checkMinimumOrder(Number(priced.totals?.subtotal), commerce.minOrderValue);
  if (minimum.below) {
    throw new AppError(
      `This shop's minimum order is ${formatCurrency(commerce.minOrderValue, currency)}. Please add ${formatCurrency(minimum.shortfall, currency)} more to continue.`,
      409,
    );
  }

  // An online payment must be against a cart the shop priced. Without this a
  // caller could skip the quote entirely and go straight to placement with
  // whatever numbers they liked — which is the hole the draft exists to close.
  if (input.paymentMethod !== "cod" && !draft) {
    throw new AppError(
      "This cart needs to be priced again before payment. Please refresh and retry.",
      409,
    );
  }

  // The server decides whether an order is paid. It used to be
  //   input.paymentStatus ?? (paymentMethod === "cod" ? "cod" : "paid")
  // — the caller's word, and "paid" by default for anything that was not COD. A
  // plain anonymous POST with `paymentMethod: "razorpay"` and no payment
  // whatsoever was therefore stored as CONFIRMED and PAID.
  //
  // Now: cash is cash, and anything else is only paid once the GATEWAY says the
  // money was captured. Anything unconfirmed lands as "pending", which is the
  // honest answer — the shop can see it and reconcile, and no one is told money
  // arrived that did not.
  const payment =
    input.paymentMethod === "cod"
      ? null
      : await checkRazorpayPayment(input.paymentReference ?? "");

  if (payment?.unavailable) {
    // An operator problem, not a customer one: the order is still taken, just
    // not marked paid. Logged so it is visible when reconciling.
    console.error(`[orders] Could not confirm payment with Razorpay: ${payment.unavailable}`);
  }

  // Captured is not enough on its own — it has to be captured FOR THIS CART.
  // Without the amount and order-id checks a genuine 1-rupee payment could be
  // presented against any cart, which is the same hole from the other end.
  // Still the DRAFT's total, not `priced` — a gateway payment is only ever
  // opened against a draft (the guard above requires one), and the amount that
  // must match is the amount the shop held at the moment it asked for money.
  const expectedTotal = draft ? Number(draft.totals?.total) : null;
  const amountMatches =
    payment?.amount == null || expectedTotal == null
      ? false
      : Math.abs(payment.amount - expectedTotal) < 0.01;
  const boundToDraft =
    !draft?.razorpayOrderId || !payment?.orderId || payment.orderId === draft.razorpayOrderId;

  if (payment?.captured && (!amountMatches || !boundToDraft)) {
    console.error(
      `[orders] Payment ${input.paymentReference} does not match its cart` +
        ` (paid ${payment.amount}, expected ${expectedTotal};` +
        ` gateway order ${payment.orderId}, draft ${draft?.razorpayOrderId}).`,
    );
  }

  const paymentStatus: PaymentStatus =
    input.paymentMethod === "cod"
      ? "cod"
      : payment?.captured && amountMatches && boundToDraft
        ? "paid"
        : "pending";

  // Not client-settable either: an order begins its life confirmed, and every
  // later state comes from an admin action through `updateStatus`.
  const status: OrderStatus = "confirmed";
  const order: PlacedOrder = {
    // Use the client-provided identity/state when present (storefront), else
    // generate (direct API). Keeps local and server copies in agreement.
    id: input.id ?? randomUUID(),
    // Always minted here. The client used to propose one so its success page had
    // a number early, and the server only reissued on collision — but the client
    // already adopts whatever comes back (`adoptStoredOrder`), so owning it
    // outright costs nothing and removes a caller-chosen key from the record.
    orderNumber: await generateOrderNumber(commerce),
    // The SHOP's prices — from the draft it quoted, or re-priced here for a
    // caller that never quoted. `input.items[].price` and `input.totals` are
    // never stored: that is how a 5000-rupee cake could be ordered at 1 rupee.
    items: priced.items as unknown as PlacedOrder["items"],
    totals: priced.totals as unknown as PlacedOrder["totals"],
    address: input.address as unknown as PlacedOrder["address"],
    paymentMethod: input.paymentMethod,
    paymentStatus,
    paymentReference: input.paymentReference,
    // Resolved by the shop against its own coupon list. It used to arrive as
    // an object the caller invented, discount included, and then appeared in
    // the admin's coupon performance report as if it were real.
    coupon: priced.coupon as unknown as PlacedOrder["coupon"],
    orderNotes: input.orderNotes,
    deliverySlot: input.deliverySlot as unknown as PlacedOrder["deliverySlot"],
    placedAt,
    status,
    statusHistory: [{ status, at: placedAt }],
    estimatedDelivery: resolveEstimatedDelivery(
      input,
      commerce,
      (priced.totals ?? null) as unknown as Record<string, unknown> | null,
    ),
  };

  // Atomic: create the order AND reduce stock for each line together.
  //
  // Idempotent on the client-supplied id. The storefront retries this POST —
  // by the time it runs the customer's card has already been charged, so one
  // dropped response must not be the end of it — and a retry must not produce a
  // second order or decrement stock twice.
  const reductions = priced.items.map((item) => ({
    slug: item.productSlug,
    quantity: item.quantity,
  }));

  // Claim the priced cart BEFORE inserting anything.
  //
  // This used to happen after the insert, and the result was discarded. Two
  // placements of the same draft arriving together — a double-clicked Pay
  // button, or the browser and the webhook racing — therefore both passed the
  // "one payment, one order" check (which reads before either has written,
  // and `paymentReference` is deliberately not uniquely indexed), both
  // inserted, and both decremented stock. One captured payment, two paid
  // orders. Claiming first makes the draft the single place the two requests
  // are serialised.
  if (draft) {
    const claimed = await consumeDraft(draft.id, order.id);
    if (!claimed) {
      const current = await findDraft(draft.id);
      const ownerId = current?.consumedByOrderId ?? null;

      if (ownerId && ownerId !== order.id) {
        const winner = await repo.findById(ownerId);
        if (winner) {
          // Someone else placed this cart. Same reasoning as the idempotent
          // branch below: this endpoint is anonymous, so the record only goes
          // back to a caller who already knows the contact details on it.
          if (!verifyOrderLookup(winner, input.address)) throw new NotFoundError("Order not found");
          return winner;
        }
        // The winner claimed the draft and never inserted. Take it over, or
        // stand down if another retry got there first.
        if (!(await reclaimDraft(draft.id, ownerId, order.id))) {
          throw new AppError("This cart is already being placed. Please wait a moment and retry.", 409);
        }
      }
      // ownerId === order.id: our own retry. Fall through; the insert returns
      // `already-placed` and the idempotent branch handles it.
    }
  }

  let candidate = order;
  let placed: PlacedOrder | null = null;
  // Whether a row with this id is in the collection. Decides, on the way out
  // through the catch, whether the draft claim is safe to hand back: releasing
  // it while an order exists would let the same payment be placed a second time.
  let orderRecorded = false;

  try {
    // The loop exists for orderNumber collisions only. The storefront picks its
    // own number, de-duplicated against that browser's orders alone, so two
    // customers clash regularly. The server owns uniqueness: mint a fresh number
    // and insert again. Bounded because each attempt is a real round trip, and
    // generateOrderNumber already checks the collection.
    for (let attempt = 0; attempt < ORDER_NUMBER_ATTEMPTS && !placed; attempt += 1) {
      // Oversell only for money that has actually arrived — see the parameter's
      // own note. An unpaid caller is refused instead, which is what stops an
      // anonymous POST driving the catalogue negative.
      const outcome = await repo.createOrderWithStockReduction(
        candidate,
        reductions,
        paymentStatus === "paid",
      );

      if (outcome.kind === "already-placed") {
        orderRecorded = true;
        // This endpoint is deliberately unauthenticated — it is the storefront
        // checkout. That makes the idempotent branch a read of stored data keyed
        // on a guessable id, so it must not hand back a stranger's record: name,
        // phone, street address, every line item. A genuine retry always carries
        // the same contact details it was placed with, so requiring them costs
        // nothing and closes the oracle.
        if (!verifyOrderLookup(outcome.order, input.address)) {
          throw new NotFoundError("Order not found");
        }

        // Nothing changed, so there is nothing to refresh and nothing new to
        // record — a second audit entry would read as a second order.
        return outcome.order;
      }

      if (outcome.kind === "created") {
        orderRecorded = true;
        placed = outcome.order;
        break;
      }

      candidate = { ...candidate, orderNumber: await generateOrderNumber(commerce) };
    }

    if (!placed) {
      // Never claim a placement we could not make. The caller reports the order
      // unconfirmed and the customer can retry, which is recoverable; a false
      // success is not.
      throw new Error("Could not allocate a unique order number");
    }
  } catch (error) {
    // Nothing was stored, so the claim has to go back — otherwise a refused
    // order (out of stock, a bad orderNumber run) would strand the draft and the
    // customer could never retry a cart they have already paid for.
    if (draft && !orderRecorded) await releaseDraft(draft.id, order.id);
    throw error;
  }

  // This payment has an order now, so any "money with no order" alarm raised
  // for it is answered. The webhook records one before returning 500 to force a
  // retry; without this the retry would succeed and the alarm would still be
  // sitting on the Payments screen with no way to clear it.
  if (placed.paymentReference) {
    await resolveUnclaimedPayment(placed.paymentReference, placed.id).catch(() => undefined);
  }

  // The redemption counter, recorded where it can actually be written. The
  // client used to do this through `PUT /api/coupons`, which requires an admin
  // role — so for a real customer it was a guaranteed 403 and the count only
  // ever moved when an admin checked out.
  // `priced.coupon`, not `draft.coupon`. A COD order placed without quoting has
  // its coupon RESOLVED by `repriceForPlacement` against the shop's own list —
  // the discount is real and comes off the total — so not counting it here
  // would let a usage-limited code be spent an unlimited number of times
  // through the one path that skips the quote.
  const redeemed = (priced.coupon as { code?: string } | null | undefined)?.code;
  if (redeemed) {
    try {
      await recordCouponRedemption(redeemed);
    } catch (error) {
      // A miscounted redemption is a reporting problem; failing the order over
      // it would be far worse.
      console.error(`[orders] Could not record coupon usage: ${String(error)}`);
    }
  }

  // Best-effort: refresh each affected product's derived stockStatus (the $inc
  // changed the quantity but not the status field). Not part of the transaction.
  await refreshStockStatuses(reductions.map((r) => r.slug));

  await writeAuditLog({
    action: "order.place",
    actorEmail: input.address.email,
    target: { type: "order", id: placed.id },
    metadata: {
      orderNumber: placed.orderNumber,
      // What the SHOP charged. This recorded `input.totals.total` — the
      // caller's claim — so the one record kept specifically to be trusted
      // later carried the number the audit exists to detect lies about.
      total: placed.totals.total,
      method: input.paymentMethod,
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  // Awaited, but never allowed to fail the placement: the order is already
  // committed and paid for, so throwing here would report a successful order as
  // failed and send the customer into the retry path for something that is
  // already done. A missing confirmation email is an operator problem.
  // An absolute URL, because an email is read outside the app where a relative
  // path goes nowhere. Every variable the template declares is supplied here —
  // an unsupplied one renders as the literal `{{invoice_url}}` in the customer's
  // inbox, which is how this was caught.
  const base = await publicBaseUrl();
  // The Payment Notifications screen calls this "Payment Success". Its switches
  // stored a preference that nothing read, so an admin who turned this off
  // because customers complained about volume got a green toast and the next
  // order sent it anyway.
  const mail = (await isNotificationEnabled("cust_payment_success", "email"))
    ? await sendTemplatedEmail("order_confirmation", placed.address.email, {
        customer_name: placed.address.fullName?.trim() || "there",
        order_number: placed.orderNumber,
        order_total: formatCurrency(placed.totals.total, currency),
        payment_method:
          placed.paymentMethod === "cod" ? "Cash on delivery" : "Paid online",
        delivery_date: placed.deliverySlot?.date
          ? `${placed.deliverySlot.date}${placed.deliverySlot.timeSlot ? `, ${placed.deliverySlot.timeSlot}` : ""}`
          : new Date(placed.estimatedDelivery).toDateString(),
        invoice_url: base
          ? `${base}${routes.store.orderTrack}?order=${encodeURIComponent(placed.orderNumber)}`
          : "Reply to this email and we will send your invoice.",
      })
    : null;

  if (mail && !mail.sent) {
    console.error(
      `[orders] Could not email the confirmation for ${placed.orderNumber}: ${mail.error}`
    );
  }

  // The same news on WhatsApp, when the shop has connected one.
  //
  // An ADDITION to the email, never a replacement: a shop with no WhatsApp
  // provider is the normal state, and `notifyWhatsApp` is silent about it
  // rather than logging a failure on every order. Note that this passes no
  // `invoice_url` — a link has to be inside the wording Meta approved, so it
  // cannot be supplied per-message the way it can in an email.
  await notifyWhatsApp(
    "order_confirmation",
    placed.address.phone,
    {
      customer_name: placed.address.fullName?.trim() || "there",
      order_number: placed.orderNumber,
      order_total: formatCurrency(placed.totals.total, currency),
      delivery_date: placed.deliverySlot?.date
        ? `${placed.deliverySlot.date}${placed.deliverySlot.timeSlot ? `, ${placed.deliverySlot.timeSlot}` : ""}`
        : new Date(placed.estimatedDelivery).toDateString(),
    },
    `confirmation for ${placed.orderNumber}`,
  );

  // And tell the BAKERY.
  //
  // Nothing did. The customer got a confirmation, the order appeared in an admin
  // screen nobody had open, and a cake needed baking by Saturday — the system
  // was silent towards the only people who could act on it. Best effort and
  // never allowed to fail the placement, exactly like the customer's copy.
  await notifyShopOfOrder(placed, settings, currency, base);

  return placed;
}

/**
 * Emails the shop its own new order.
 *
 * Goes to the CONTACT email the shop has already published on its site — the
 * one place an address for the bakery itself is configured. No address means no
 * notification rather than a guess: mailing the from-address instead would send
 * a noreply@ mailbox a message nobody reads.
 */
async function notifyShopOfOrder(
  order: PlacedOrder,
  settings: Record<string, unknown>,
  currency: string | undefined,
  base: string,
): Promise<void> {
  const shopEmail = ((settings.contact ?? {}) as { email?: string }).email?.trim();
  if (!shopEmail) return;

  const items = order.items
    .map((item) => `  ${item.quantity} x ${item.name}`)
    .join("\n");

  // "Payment Received" on the Payment Notifications screen.
  if (!(await isNotificationEnabled("admin_payment_received", "email"))) return;
  const mail = await sendTemplatedEmail("admin_new_order", shopEmail, {
    order_number: order.orderNumber,
    order_total: formatCurrency(order.totals.total, currency),
    customer_name: order.address.fullName,
    customer_phone: order.address.phone,
    payment_method: order.paymentMethod === "cod" ? "Cash on delivery" : "Paid online",
    delivery_date: order.deliverySlot?.date
      ? `${order.deliverySlot.date}${order.deliverySlot.timeSlot ? `, ${order.deliverySlot.timeSlot}` : ""}`
      : new Date(order.estimatedDelivery).toDateString(),
    delivery_address: [
      order.address.addressLine1,
      order.address.addressLine2,
      `${order.address.city} ${order.address.pincode}`,
    ]
      .filter(Boolean)
      .join(", "),
    order_items: items,
    admin_url: base
      ? `${base}${routes.admin.orders.detail(order.id)}`
      : "Open the admin to see it.",
  });

  if (!mail.sent) {
    console.error(
      `[orders] Could not notify the shop about ${order.orderNumber}: ${mail.error}`,
    );
  }
}

async function refreshStockStatuses(slugs: string[]): Promise<void> {
  const unique = [...new Set(slugs)];
  await Promise.all(
    unique.map(async (slug) => {
      try {
        const product = await productRepo.findBySlug(slug);
        if (!product || product.unlimitedStock) return;
        const stockStatus = deriveStockStatus({
          stockQuantity: product.stockQuantity,
          unlimitedStock: false,
          lowStockThreshold: product.lowStockThreshold,
        });
        if (stockStatus !== product.stockStatus) {
          await productRepo.patchFields(product.id, { stockStatus });
        }
      } catch {
        // A stock-status refresh failure must not fail the order.
      }
    }),
  );
}

// ---- Reads ----------------------------------------------------------------

/** Filtered + paginated page for the admin order list. */
export function getOrdersPage(query: repo.OrderListQuery) {
  return repo.list(query);
}

/**
 * Counts and revenue across every order, aggregated in Mongo.
 *
 * Kept separate from the list so the admin's totals stay correct no matter how
 * few rows the current page happens to carry.
 */
export function getStats() {
  return repo.stats();
}
export function getById(id: string) {
  return repo.findById(id);
}
export function getByNumber(orderNumber: string) {
  return repo.findByNumber(orderNumber);
}
export function getByCustomer(email: string) {
  return repo.findByCustomerEmail(email);
}

// ---- Lifecycle mutations --------------------------------------------------

async function requireOrder(id: string): Promise<PlacedOrder> {
  const order = await repo.findById(id);
  if (!order) throw new NotFoundError("Order not found");
  return order;
}

export async function updateStatus(id: string, status: OrderStatus, ctx: RequestCtx) {
  const order = await requireOrder(id);
  if (order.status === status) return order;

  // The rule lives HERE, not on a dropdown.
  //
  // There was no server-side transition check at all: `isTerminalOrderStatus`
  // had a single caller, a `disabled` prop on the detail page's select. The
  // Orders list gives every row a checkbox including under the Cancelled and
  // Refunded tabs, so select-all → bulk status → Apply wrote a refunded order
  // back to `delivered`. Its total then re-entered the Revenue card having
  // already been paid back, it re-entered the fulfilment queue, and cancelling
  // it a second time put its stock back a second time — the shop oversold what
  // it had never got back.
  const refusal = orderStatusTransitionError(order.status, status);
  if (refusal) throw new AppError(refusal, 409);

  const now = new Date().toISOString();
  const updated = await repo.patch(id, {
    status,
    statusHistory: [...order.statusHistory, { status, at: now }],
  });
  await audit(ctx, "order.status", id, { status });

  // Tell the customer their cake has left the bakery.
  //
  // The `order_shipped` template was seeded ACTIVE and shown in the template
  // editor, and nothing sent it — an admin could word it carefully and no
  // customer would ever see it. This is the moment it describes, and it is the
  // one status change a customer genuinely wants to hear about: the confirmation
  // told them it was coming, and until now nothing told them it was on the way.
  //
  // Awaited but never allowed to fail the status change: the cake is already out
  // for delivery, and reporting that as a failure would have an admin set the
  // status twice.
  if (status === "out_for_delivery" && updated) {
    await notifyOutForDelivery(updated);
  }

  // "Your cake is ready" has no email behind it and does not need one — it is
  // the kind of short, immediate note a phone is for. It exists only on
  // WhatsApp, so a shop without a provider sends nothing here, which is what
  // happened before this line too.
  if (status === "ready" && updated) {
    await notifyWhatsApp(
      "order_ready",
      updated.address.phone,
      {
        customer_name: updated.address.fullName?.trim() || "there",
        order_number: updated.orderNumber,
      },
      `ready alert for ${updated.orderNumber}`,
    );
  }

  return updated;
}

/**
 * Sends the customer their invoice, on request.
 *
 * The storefront button for this was a toast saying the feature awaited a
 * backend that already existed. The link is absolute and degrades to prose when
 * no public origin is configured, exactly like the confirmation email — a
 * relative path in an email goes nowhere.
 */
export async function emailInvoice(order: PlacedOrder): Promise<{ sent: boolean; error?: string }> {
  const settings = (await getSettings()) as Record<string, unknown>;
  const currency = ((settings.general ?? {}) as GeneralSettings).currency;
  const base = await publicBaseUrl();

  // "Invoice Generated" on the Payment Notifications screen.
  if (!(await isNotificationEnabled("cust_invoice_generated", "email"))) {
    return { sent: false, error: "Invoice emails are switched off in notification settings." };
  }

  return sendTemplatedEmail("invoice", order.address.email, {
    customer_name: order.address.fullName?.trim() || "there",
    order_number: order.orderNumber,
    order_total: formatCurrency(order.totals.total, currency),
    order_date: new Date(order.placedAt).toDateString(),
    invoice_url: base
      ? `${base}${routes.store.orderDetail(order.orderNumber)}/invoice`
      : "Reply to this email and we will send your invoice as a PDF.",
  });
}

/**
 * Tell a customer their order was cancelled, and what happens to their money.
 *
 * `refund_note` is the honest part. Whether anything is coming back depends on
 * whether anything was taken, and that is the first thing they will ask.
 */
async function notifyOrderCancelled(order: PlacedOrder, holdsPayment: boolean): Promise<void> {
  const { general } = (await getSettings()) as unknown as { general: GeneralSettings };

  const mail = await sendTemplatedEmail("order_cancelled", order.address.email, {
    customer_name: order.address.fullName?.trim() || "there",
    order_number: order.orderNumber,
    order_total: formatCurrency(order.totals.total, general?.currency),
    refund_note: holdsPayment
      ? "You paid for this order, so a refund is on its way. It usually takes 5–7 working days to reach your account."
      : "No payment was taken for this order, so there is nothing to refund.",
  });

  if (!mail.sent) {
    console.error(
      `[orders] Could not send the cancellation email for ${order.orderNumber}: ${mail.error}`,
    );
  }
}

async function notifyOutForDelivery(order: PlacedOrder): Promise<void> {
  const address = [
    order.address.addressLine1,
    order.address.addressLine2,
    `${order.address.city} ${order.address.pincode}`,
  ]
    .filter(Boolean)
    .join(", ");

  const mail = await sendTemplatedEmail("order_shipped", order.address.email, {
    customer_name: order.address.fullName?.trim() || "there",
    order_number: order.orderNumber,
    delivery_date: order.deliverySlot?.date
      ? `${order.deliverySlot.date}${order.deliverySlot.timeSlot ? `, ${order.deliverySlot.timeSlot}` : ""}`
      : new Date(order.estimatedDelivery).toDateString(),
    delivery_address: address,
  });

  if (!mail.sent) {
    console.error(
      `[orders] Could not send the out-for-delivery email for ${order.orderNumber}: ${mail.error}`,
    );
  }

  await notifyWhatsApp(
    "delivery_update",
    order.address.phone,
    {
      customer_name: order.address.fullName?.trim() || "there",
      order_number: order.orderNumber,
      delivery_address: address,
    },
    `out-for-delivery alert for ${order.orderNumber}`,
  );
}

/**
 * Hand a coupon redemption back when the order it belonged to falls through.
 *
 * `usageCount` only ever went up, so a coupon with a usage limit was spent by
 * orders that were cancelled or refunded — and the admin's coupon performance
 * report counted those redemptions forever. Best effort: a miscount is a
 * reporting problem, and failing a cancellation over it would be far worse.
 */
/**
 * Give a coupon redemption back. Once per order, whichever path gets there.
 *
 * Cancelling releases it and so does a full settled refund — and refunding a
 * cancelled order is the ordinary sequence, so both ran and the customer's
 * single-use code came back twice. The refund tracked its own
 * `refundRecord.couponReleased`; cancellation never saw that flag and had none
 * of its own.
 *
 * The claim is on the ORDER, so it is the same claim for both paths.
 */
async function releaseCoupon(order: PlacedOrder): Promise<void> {
  const code = order.coupon?.code;
  if (!code) return;

  if (!(await repo.claimCouponRelease(order.id))) return;

  try {
    await releaseCouponRedemption(code);
  } catch (error) {
    console.error(`[orders] Could not release coupon usage for ${order.orderNumber}: ${String(error)}`);
  }
}

/** The stock an order took off the shelf, for putting back. */
function stockFor(order: PlacedOrder) {
  return order.items.map((item) => ({ slug: item.productSlug, quantity: item.quantity }));
}

export async function cancel(id: string, cancellationReason: string | undefined, ctx: RequestCtx) {
  const order = await requireOrder(id);
  if (order.status === "cancelled" || order.status === "refunded") return order;

  const now = new Date().toISOString();

  // THE STATUS CHANGE IS THE GUARD.
  //
  // This was a read, a check and a patch — three steps — with a comment saying
  // the check kept the work below from running twice. It did not: a
  // double-clicked Cancel, or two operators on the same order, both read
  // `confirmed`, both passed, and both restored the stock and released the
  // coupon. A three-cake order ended up six on the shelf.
  const updated = await repo.cancelIfActive(id, {
    status: "cancelled",
    cancellationReason: cancellationReason?.trim() || undefined,
    statusHistory: [...order.statusHistory, { status: "cancelled", at: now }],
  });

  // Someone else cancelled it between the read and the write. They are doing
  // the work below; this request must not repeat any of it.
  if (!updated) return await requireOrder(id);

  // The cakes are back on the shelf. Nothing in this repo ever added stock, so
  // a cancelled order used to destroy inventory permanently — the shop's own
  // counts drifted down every time it corrected a mistake.
  //
  // Not for a DELIVERED order, though: those cakes have left the building. Adding
  // them back invents stock, and `createOrderWithStockReduction` will then
  // happily sell the phantom units to the next customer.
  if (order.status !== "delivered") {
    await repo.restoreStock(stockFor(order));
  }

  // Cancelling does not move money. A paid order cancelled here still has the
  // customer's payment sitting in the gateway account, and this is the state
  // `requestRefund` expects — so say so rather than leaving it to be noticed.
  const holdsPayment = order.paymentStatus === "paid";
  if (holdsPayment) {
    console.info(
      `[orders] Cancelled ${order.orderNumber} still holds a captured payment — it needs a refund.`,
    );
  }

  // TELL THE CUSTOMER.
  //
  // Cancelling wrote a status, put the stock back and released the coupon, and
  // sent nothing at all. The customer found out by the cake never arriving —
  // and if they had paid, their money was sitting in the gateway with nothing
  // anywhere saying so. Every other status change they care about has an email;
  // the one they most need was the one that did not.
  //
  // Awaited but never allowed to fail the cancellation: the order IS cancelled,
  // and reporting that as a failure would have an operator do it twice.
  await notifyOrderCancelled(updated, holdsPayment);

  await releaseCoupon(order);

  await audit(ctx, "order.cancel", id, { reason: cancellationReason });
  return updated;
}

export async function updatePayment(
  id: string,
  paymentStatus: PaymentStatus,
  paymentReference: string | undefined,
  ctx: RequestCtx,
) {
  const order = await requireOrder(id);
  if (order.status === "refunded" || order.paymentStatus === "refunded") return order;

  const updated = await repo.patch(id, {
    paymentStatus,
    paymentReference:
      paymentReference?.trim() ||
      order.paymentReference ||
      (paymentStatus === "paid"
        ? `MANUAL-${order.orderNumber.slice(-6).toUpperCase()}`
        : order.paymentReference),
  });
  await audit(ctx, "order.payment", id, { paymentStatus });
  return updated;
}

export async function updateAdminNotes(id: string, adminNotes: string, ctx: RequestCtx) {
  await requireOrder(id);
  const updated = await repo.patch(id, { adminNotes: adminNotes.trim() || undefined });
  await audit(ctx, "order.notes", id);
  return updated;
}

/**
 * Refund part or all of an order — for real.
 *
 * What this used to be: a write. It set `refundRecord.status: "completed"`,
 * flipped the order to `refunded`, minted a `REF-…` reference of its own and
 * returned. No gateway was contacted, so the customer's money never moved, and
 * nothing in the stored data distinguished that from a payout that had happened.
 *
 * `order.status === "refunded"` is no longer the re-entry guard, because it was
 * never a sound one. It let a partial refund mark the order fully refunded (so
 * the rest could never be paid back), and `updateStatus` accepts any status with
 * no transition check, so moving a refunded order back to `confirmed` re-opened
 * the whole path for a second payout. The amounts are the guard now: what the
 * gateway says is still refundable, and what we have already refunded.
 */
export async function refund(id: string, input: RefundInput, ctx: RequestCtx) {
  const order = await requireOrder(id);

  const existing = order.refundRecord ?? null;
  const priorRefunds = existing?.gatewayRefunds ?? [];
  const priorVersion = Number(existing?.version) || 0;
  const isOnline = order.paymentMethod !== "cod";

  // Ask the GATEWAY what is left before deciding anything. Our own record is not
  // a reliable source here: orders placed before payment verification existed
  // carry whatever `paymentStatus` the browser sent, so "paid" in Mongo can mean
  // nothing was ever collected. Razorpay knows what it captured.
  const gatewayState =
    isOnline && order.paymentReference
      ? await getRefundableAmount(order.paymentReference)
      : { refundable: null as number | null };

  const plan = planRefund({
    paymentMethod: order.paymentMethod,
    status: order.status,
    orderTotal: order.totals.total,
    paymentReference: order.paymentReference,
    refundRecord: existing,
    gatewayRefundable: isOnline ? gatewayState.refundable : null,
    requestedAmount: input.amount,
  });

  // A no-op is a refusal too, and has to say so.
  //
  // Returning the order unchanged made the controller answer 200 "Order
  // refunded", so clicking Refund on an already fully-refunded order produced a
  // success toast and no payout — the exact shape of failure this whole change
  // exists to remove.
  if (plan.kind === "noop") throw new AppError(plan.reason, 409);
  if (plan.kind === "refuse") {
    // 503 for "ask again" (the gateway was unreachable), 409 for "never".
    throw new AppError(plan.reason, plan.retryable ? 503 : 409);
  }

  const now = new Date().toISOString();
  const reason = (input.reason as RefundRecord["reason"]) ?? "customer_request";
  let appended: GatewayRefund | null = null;

  // CLAIM THE SLOT BEFORE THE MONEY MOVES.
  //
  // The compare-and-set used to run at the END, after the gateway had already
  // paid out — so it protected the RECORD and not the MONEY. Two admins
  // refunding ₹1,000 each on a ₹2,000 payment both passed `planRefund`, because
  // Razorpay's own cap is the captured total and ₹1,000 + ₹1,000 is inside it.
  // Both payouts happened; the second write lost the CAS and answered 409 for a
  // refund that had really been made. The shop was ₹1,000 down with no record.
  //
  // Now the loser of the race is refused here, having moved nothing. A retry
  // arriving while an attempt is still open is refused for the same reason.
  if (existing?.pendingAttempt) {
    throw new AppError(
      `A refund of ${formatRefundAmount(existing.pendingAttempt.amount)} for this order is already in progress. ` +
        "Check the refund history before trying again — the money may already have moved.",
      409,
    );
  }

  const claimed = await repo.claimRefundAttempt(id, priorVersion, {
    amount: plan.amount,
    at: now,
    actorEmail: ctx.actorEmail,
  });

  if (!claimed) {
    throw new AppError(
      "Another refund for this order was started at the same moment. Reload and check the refund history before retrying.",
      409,
    );
  }

  if (plan.kind === "gateway") {
    // THE MONEY MOVES HERE. Everything above decides whether it should, and
    // everything below only writes down what happened. Before this call existed,
    // the whole function was the writing-down half.
    const outcome = await createRazorpayRefund({
      paymentId: order.paymentReference!,
      amount: plan.amount,
      receipt: `${order.orderNumber}-R${priorRefunds.length + 1}`,
      orderNumber: order.orderNumber,
      reason,
    });

    if (!outcome.ok || !outcome.refundId) {
      if (outcome.ok && !outcome.refundId) {
        // Accepted but unidentifiable. The money may well be moving and we have
        // nothing to record it against; the refund webhook will recognise it and
        // attach it. Loud, because it needs a human to confirm.
        //
        // The claim STAYS. This is the one case where retrying could pay twice,
        // and an operator has to reconcile before anything else is attempted.
        console.error(
          `[orders] Razorpay accepted a refund for ${order.orderNumber} but returned no refund id. ` +
            "The refund attempt is left open deliberately — reconcile before retrying.",
        );
      } else {
        // The gateway said no, or could not be reached. Nothing moved, so the
        // slot has to go back: a claim left behind here would block the retry
        // that a 503 explicitly invites.
        await repo.releaseRefundAttempt(id, priorVersion + 1, Boolean(existing));
      }

      // Say whether the money moved, because only this code knows.
      //
      // The Refund Centre used to append "No money has moved. Nothing was
      // recorded." to EVERY refusal — including this one, where the gateway
      // accepted a payout it would not name. That is the single case where the
      // money is most likely already gone, and the screen was the most confident
      // it had not.
      if (outcome.ok) {
        throw new AppError(
          "The gateway accepted a refund but did not identify it. The money may already be on its way — " +
            "check the refund in your gateway dashboard before trying again.",
          503,
        );
      }

      throw new AppError(
        outcome.refused
          ? `${outcome.refused} No money has moved.`
          : `${outcome.unavailable ?? "The payment gateway could not be reached."} No money has moved — try again.`,
        outcome.refused ? 409 : 503,
      );
    }

    appended = {
      id: outcome.refundId,
      amount: outcome.amount ?? plan.amount,
      // The gateway's word. A refund starts `pending` and is only `processed`
      // once the money has actually left; `refund.processed` on the webhook is
      // what promotes it. Writing "completed" here is precisely what made the
      // old Refund Centre report payouts that had not happened.
      status: outcome.status ?? "pending",
      createdAt: now,
      ...(outcome.status === "processed" ? { processedAt: now } : {}),
    };
  }

  const nextRefunds = appended ? [...priorRefunds, appended] : priorRefunds;
  const offline = plan.kind === "offline";
  const refundedTotal = offline
    ? totalRefunded(existing) + plan.amount
    : totalRefunded({ ...(existing ?? {}), gatewayRefunds: nextRefunds } as RefundRecord);
  const recordStatus = deriveRefundStatus(nextRefunds, offline);
  const fully = isFullyRefunded(order.totals.total, refundedTotal);
  const settled = recordStatus === "completed";

  // Stock comes back only when the goods can. A refund on a DELIVERED order is
  // the normal case for a quality complaint — the cake has been eaten, and
  // putting it back on the shelf is how the shop oversells the next one. The old
  // code restored for any order that was not already cancelled, delivered
  // included. `stockRestored` is persisted rather than inferred because a bank
  // rejection lowers the refunded total again, and each flip would restore twice.
  const goodsReturnable = order.status !== "delivered" && order.status !== "cancelled";
  const restoreNow = fully && settled && goodsReturnable && !existing?.stockRestored;
  // A partial refund is still a sale the coupon paid for; only a full one gives
  // the redemption back.
  const releaseCouponNow = fully && settled && !existing?.couponReleased;

  const refundRecord: RefundRecord = {
    // The claim took priorVersion + 1; recording the outcome moves it on again,
    // so a request holding either number cannot overwrite this.
    version: priorVersion + 2,
    // `pendingAttempt` is deliberately absent: writing the whole record clears
    // it, which is what marks this attempt finished. One left behind means the
    // request died between asking the gateway and writing the answer down.
    status: recordStatus,
    reason,
    reasonDetail: input.reasonDetail?.trim() || existing?.reasonDetail,
    amount: round2(refundedTotal),
    // The gateway's id, which reconciles. The old `REF-<orderNumber>` matched no
    // record at any gateway or bank — it was a string this codebase invented.
    reference: appended?.id ?? existing?.reference,
    notes: input.notes?.trim() || existing?.notes,
    requestedAt: existing?.requestedAt ?? now,
    completedAt: settled ? now : existing?.completedAt,
    gatewayRefunds: nextRefunds,
    offline: offline || existing?.offline,
    stockRestored: existing?.stockRestored || restoreNow,
    couponReleased: existing?.couponReleased || releaseCouponNow,
    history: [
      ...(existing?.history ?? []),
      {
        status: recordStatus,
        at: now,
        note:
          input.notes?.trim() ||
          `${fully ? "Full" : "Partial"} refund of ${formatRefundAmount(plan.amount)}` +
            (offline ? " recorded (cash returned by hand)" : ` sent to the gateway`),
      },
    ],
  };

  // Only a settled, complete refund flips the order itself. A refund the gateway
  // has accepted but not yet paid out is `processing`, and saying "refunded"
  // then would be the same lie in a different field.
  // Compare against the version the CLAIM took, not the one read at the start —
  // the claim already moved it. Nothing else can be holding this number, so this
  // write cannot lose a race for a payout that has already happened.
  const updated = await repo.compareAndSetRefund(id, priorVersion + 1, {
    refundRecord,
    refundReference: refundRecord.reference,
    ...(fully && settled
      ? {
          status: "refunded" as OrderStatus,
          paymentStatus: "refunded" as PaymentStatus,
          statusHistory: [...order.statusHistory, { status: "refunded" as OrderStatus, at: now }],
        }
      : {}),
  });

  if (!updated) {
    // Someone recorded a refund between our read and our write. The gateway
    // refund itself is already made and Razorpay caps the total, so no double
    // payout is possible — but this record has to be reconciled by hand.
    console.error(
      `[orders] Refund ${appended?.id ?? "(offline)"} on ${order.orderNumber} raced another refund and was not recorded.`,
    );
    throw new AppError(
      "Another refund was recorded for this order at the same moment. Reload and check the refund history before retrying.",
      409,
    );
  }

  if (restoreNow) await repo.restoreStock(stockFor(order));
  if (releaseCouponNow) await releaseCoupon(order);

  await sendRefundEmail(updated, plan.amount, settled);
  await audit(ctx, "order.refund", id, {
    amount: plan.amount,
    refundId: appended?.id ?? null,
    offline,
    status: recordStatus,
  });
  return updated;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatRefundAmount(amount: number): string {
  return `₹${round2(amount)}`;
}

/**
 * Tell the customer their money is coming back.
 *
 * Nothing told them before. The refund existed only inside the admin panel, so
 * from the customer's side a refund and silence were the same event — and the
 * storefront's order pages read from that browser's localStorage, so the state
 * change was invisible there too.
 */
async function sendRefundEmail(order: PlacedOrder, amount: number, settled: boolean) {
  const email = order.address?.email;
  if (!email) return;

  // "Refund Completed" on the Payment Notifications screen — a switch that
  // stored a preference nothing read.
  if (!(await isNotificationEnabled("cust_refund_completed", "email"))) return;

  const settings = await getSettings().catch(() => null);
  const currency = (settings?.general as GeneralSettings | undefined)?.currency;

  const mail = await sendTemplatedEmail("refund_processed", email, {
    customer_name: order.address.fullName?.trim() || "there",
    order_number: order.orderNumber,
    refund_amount: formatCurrency(amount, currency),
    refund_reference: order.refundRecord?.reference ?? order.orderNumber,
    // Cash handed back is already in their hand; a gateway refund is not.
    refund_eta: order.refundRecord?.offline
      ? "no time at all — this was returned in cash"
      : settled
        ? "3–5 working days"
        : "5–7 working days",
  });

  if (!mail.sent) {
    console.error(`[orders] Could not email the refund for ${order.orderNumber}: ${mail.error}`);
  }
}

/**
 * The gateway confirming, later, a payment we could not confirm at the time.
 *
 * `checkRazorpayPayment` fails CLOSED — correctly, since overstating payment is
 * money the shop never receives — so a network blip during placement stores a
 * genuinely captured payment as `pending`. Nothing ever re-asked: that lookup
 * has one caller, there is no reconciliation job, and the order then sat wrong
 * forever on three cards at once while the money was really in the account.
 *
 * Only ever upgrades `pending` → `paid`, and only for the payment reference the
 * order already carries. It cannot downgrade, and it cannot touch a refunded or
 * cancelled order.
 */
/**
 * Ask the gateway about refunds it never told us had settled.
 *
 * `settleGatewayRefund` is driven by the `refund.processed` webhook, and a
 * webhook is a delivery someone else makes. If it never arrives — no secret
 * configured, a wrong URL, Razorpay giving up after its retry window — the
 * refund record sits at `processing` for good. The money has almost certainly
 * left; the shop's own Refund Centre is the only place that does not know.
 *
 * So this pulls the answer instead of waiting to be pushed it. Same settle path,
 * so stock, coupons and the order's own status all follow the same rules.
 * `fetchRazorpayRefund` existed for exactly this and had no caller.
 */
export async function reconcilePendingRefunds(
  limit = 50,
): Promise<{ checked: number; settled: number; stillPending: number }> {
  const orders = await repo.listUnsettledRefunds(limit);
  let settled = 0;
  let stillPending = 0;
  let checked = 0;

  for (const order of orders) {
    for (const refund of order.refundRecord?.gatewayRefunds ?? []) {
      if (refund.status !== "pending") continue;
      checked += 1;

      const latest = await fetchRazorpayRefund(refund.id);
      if (latest.unavailable || !latest.status) {
        // Could not ask. Leave it alone — guessing at a refund's state is the
        // failure this whole change exists to remove.
        stillPending += 1;
        continue;
      }
      if (latest.status === "pending") {
        stillPending += 1;
        continue;
      }

      const ok = await settleGatewayRefund({
        refundId: refund.id,
        paymentId: order.paymentReference ?? "",
        amount: latest.amount ?? refund.amount,
        status: latest.status,
      });
      if (ok) settled += 1;
    }
  }

  if (settled > 0) {
    console.info(`[orders] Reconciled ${settled} refund(s) the webhook never reported.`);
  }
  return { checked, settled, stillPending };
}

/** The order a gateway payment produced, if any. Identifies the money, not the cart. */
export function findOrderByPayment(paymentId: string) {
  return repo.findByPaymentReference(paymentId);
}

export async function confirmGatewayPayment(
  orderId: string,
  paymentId: string,
  amount: number,
): Promise<boolean> {
  const order = await repo.findById(orderId);
  if (!order) return false;

  // Clear any outstanding alarm for this payment BEFORE the pending check.
  //
  // A webhook-placed order is verified against the gateway and lands `paid`, so
  // the early return below would skip this entirely — and the "money with no
  // order" row it was filed under would stay on the Payments screen forever,
  // with no endpoint and no control anywhere to clear it.
  await resolveUnclaimedPayment(paymentId, order.id).catch(() => undefined);

  if (order.paymentStatus !== "pending") return false;
  if (order.status === "cancelled" || order.status === "refunded") return false;

  // The reference has to be the one this order was placed with. The caller
  // reached us through a verified webhook and a draft this order consumed, but
  // the check is cheap and keeps the rule local.
  if (order.paymentReference && order.paymentReference !== paymentId) {
    console.error(
      `[orders] Webhook payment ${paymentId} does not match ${order.orderNumber}'s reference ${order.paymentReference}.`,
    );
    return false;
  }

  // And it has to be for the right amount, for the same reason placement checks
  // it: a captured payment for some other, smaller cart is still a captured
  // payment.
  if (Math.abs(amount - Number(order.totals.total)) >= 0.01) {
    console.error(
      `[orders] Webhook payment ${paymentId} is ${amount}, but ${order.orderNumber} totals ${order.totals.total}.`,
    );
    return false;
  }

  await repo.patch(orderId, { paymentStatus: "paid", paymentReference: paymentId });
  console.info(`[orders] Webhook confirmed payment for ${order.orderNumber} (was pending).`);
  return true;
}

/**
 * A gateway refund reaching its end state.
 *
 * Two jobs. The ordinary one is promoting a refund we recorded as `pending` to
 * `processed` or `failed` — the record cannot know that at creation time,
 * because the bank decides it later.
 *
 * The other is the safety net for the one window this design cannot close: the
 * gateway accepted a refund and the process died before the record was written.
 * The money is gone and nothing on our side says so. Razorpay will tell us about
 * a refund we have never heard of, and that is the only way it gets onto the
 * order at all — so an unrecognised refund id is ATTACHED, not ignored.
 */
export async function settleGatewayRefund(input: {
  refundId: string;
  paymentId: string;
  amount: number;
  status: "processed" | "failed";
}): Promise<boolean> {
  const order = await repo.findByPaymentReference(input.paymentId);
  if (!order) return false;

  const existing = order.refundRecord ?? null;
  const priorRefunds = existing?.gatewayRefunds ?? [];
  const priorVersion = Number(existing?.version) || 0;
  const now = new Date().toISOString();

  const index = priorRefunds.findIndex((refund) => refund.id === input.refundId);
  const known = index >= 0;

  const nextRefunds: GatewayRefund[] = known
    ? priorRefunds.map((refund, i) =>
        i === index
          ? {
              ...refund,
              status: input.status,
              ...(input.status === "processed" ? { processedAt: now } : {}),
              ...(input.status === "failed"
                ? { failureReason: "The gateway could not complete this refund." }
                : {}),
            }
          : refund,
      )
    : [
        ...priorRefunds,
        {
          id: input.refundId,
          amount: input.amount,
          status: input.status,
          createdAt: now,
          ...(input.status === "processed" ? { processedAt: now } : {}),
        },
      ];

  if (!known) {
    console.error(
      `[orders] Refund ${input.refundId} on ${order.orderNumber} was not on record — attaching it from the gateway's report.`,
    );
  }

  const refundedTotal = totalRefunded({ ...(existing ?? {}), gatewayRefunds: nextRefunds } as RefundRecord);
  const recordStatus = deriveRefundStatus(nextRefunds, Boolean(existing?.offline));
  const fully = isFullyRefunded(order.totals.total, refundedTotal);
  const settled = recordStatus === "completed";
  const goodsReturnable = order.status !== "delivered" && order.status !== "cancelled";
  const restoreNow = fully && settled && goodsReturnable && !existing?.stockRestored;
  const releaseCouponNow = fully && settled && !existing?.couponReleased;

  const refundRecord: RefundRecord = {
    version: priorVersion + 1,
    status: recordStatus,
    reason: existing?.reason ?? "customer_request",
    reasonDetail: existing?.reasonDetail,
    amount: round2(refundedTotal),
    reference: existing?.reference ?? input.refundId,
    notes: existing?.notes,
    requestedAt: existing?.requestedAt ?? now,
    completedAt: settled ? now : existing?.completedAt,
    gatewayRefunds: nextRefunds,
    offline: existing?.offline,
    stockRestored: existing?.stockRestored || restoreNow,
    couponReleased: existing?.couponReleased || releaseCouponNow,
    history: [
      ...(existing?.history ?? []),
      {
        status: recordStatus,
        at: now,
        note:
          input.status === "processed"
            ? `Gateway confirmed ${formatRefundAmount(input.amount)} was paid out`
            : `Gateway could not complete a refund of ${formatRefundAmount(input.amount)}`,
      },
    ],
  };

  const updated = await repo.compareAndSetRefund(order.id, priorVersion, {
    refundRecord,
    refundReference: refundRecord.reference,
    ...(fully && settled
      ? {
          status: "refunded" as OrderStatus,
          paymentStatus: "refunded" as PaymentStatus,
          statusHistory: [...order.statusHistory, { status: "refunded" as OrderStatus, at: now }],
        }
      : {}),
  });

  if (!updated) {
    // Another write landed first. Returning false makes the webhook a 200 with
    // `settled: false`; Razorpay does not retry, so this is logged as something
    // to reconcile rather than something that will fix itself.
    console.error(
      `[orders] Refund ${input.refundId} on ${order.orderNumber} raced another write and was not recorded.`,
    );
    return false;
  }

  if (restoreNow) await repo.restoreStock(stockFor(order));
  if (releaseCouponNow) await releaseCoupon(order);
  return true;
}

export async function updateRefundNotes(id: string, notes: RefundNotesInput["notes"], ctx: RequestCtx) {
  const order = await requireOrder(id);
  if (!order.refundRecord) {
    // Returning the order unchanged made the endpoint answer 200 with the note
    // discarded — the admin typed it, saw it accepted, and it was never stored.
    throw new AppError("This order has no refund to add notes to.", 409);
  }

  // ONE FIELD. This used to spread the whole `refundRecord` into a plain patch,
  // outside the version protocol: a webhook settle landing between the read and
  // the write was erased, taking `stockRestored` and `couponReleased` with it,
  // and the next settle then restored the stock and released the coupon again.
  const updated = await repo.setRefundNotes(id, notes.trim() || undefined);
  if (!updated) throw new AppError("This order has no refund to add notes to.", 409);

  await audit(ctx, "order.refund.notes", id);
  return updated;
}

export async function requestRefund(id: string, input: RefundRequestInput, ctx: RequestCtx) {
  const order = await requireOrder(id);

  // Both refusals used to be `return order`, so the controller answered 200
  // "Refund requested" having recorded nothing. The admin logged the request,
  // closed the ticket, and no refund was ever queued.
  if (order.status !== "cancelled") {
    throw new AppError(
      "A refund can only be requested for a cancelled order. Cancel it first, or use Refund to pay one out directly.",
      409,
    );
  }
  if (order.refundRecord) {
    throw new AppError("A refund has already been requested for this order.", 409);
  }

  const now = new Date().toISOString();
  const reason = (input.reason as RefundRecord["reason"]) ?? "order_cancelled";

  const refundRecord: RefundRecord = {
    status: "requested",
    reason,
    reasonDetail: input.reasonDetail?.trim() || undefined,
    amount: order.totals.total,
    notes: input.notes?.trim() || undefined,
    requestedAt: now,
    history: [{ status: "requested", at: now, note: "Refund requested" }],
  };

  const updated = await repo.patch(id, { refundRecord });
  await audit(ctx, "order.refund.request", id, { amount: refundRecord.amount });
  return updated;
}

function audit(ctx: RequestCtx, action: string, orderId: string, metadata?: Record<string, unknown>) {
  return writeAuditLog({
    action,
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "order", id: orderId },
    metadata,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}
