import { describe, expect, it } from "vitest";

import {
  deriveRefundStatus,
  isFullyRefunded,
  planRefund,
  totalRefunded,
} from "@/features/orders/lib/refund-planning";
import { settledRefundAmount } from "@/features/orders/lib/order-overviews";
import { getPaymentAnalytics } from "@/features/payments/lib/payment-analytics";
import { timingSafeEquals, verifyWebhookSignature } from "@/features/payments/lib/webhook-signature";
import { refundSchema, statusSchema } from "@/features/orders/server/order.validators";
import type { GatewayRefund, RefundRecord } from "@/types/refund";
import type { PlacedOrder } from "@/features/orders/lib/orders";

/**
 * Refunds — the money-OUT half.
 *
 * The behaviour under test is not "refund() writes a record". It is that a
 * refund only ever reports what a gateway actually did. Every case here failed
 * before this change: a refund moved no money at all, wrote "completed" the
 * instant the button was pressed, recorded a reference that reconciled against
 * nothing, and marked an order fully refunded after a partial one.
 */

function gatewayRefund(over: Partial<GatewayRefund> = {}): GatewayRefund {
  return { id: "rfnd_1", amount: 100, status: "processed", createdAt: "2026-01-01", ...over };
}

function record(over: Partial<RefundRecord> = {}): RefundRecord {
  return { status: "completed", reason: "customer_request", amount: 0, history: [], ...over };
}

describe("totalRefunded", () => {
  it("sums the gateway refunds that have not failed", () => {
    expect(
      totalRefunded(
        record({
          gatewayRefunds: [
            gatewayRefund({ id: "a", amount: 200, status: "processed" }),
            gatewayRefund({ id: "b", amount: 150, status: "pending" }),
          ],
        }),
      ),
    ).toBe(350);
  });

  it("does not count a refund the bank rejected", () => {
    // A failed refund moved nothing, so it must not eat the customer's remaining
    // claim — otherwise a bank rejection quietly reduces what they can get back.
    expect(
      totalRefunded(
        record({
          gatewayRefunds: [
            gatewayRefund({ id: "a", amount: 200, status: "processed" }),
            gatewayRefund({ id: "b", amount: 500, status: "failed" }),
          ],
        }),
      ),
    ).toBe(200);
  });

  it("counts cash handed back on a COD order, which has no gateway list", () => {
    expect(totalRefunded(record({ offline: true, amount: 75 }))).toBe(75);
  });

  it("counts NOTHING for a record that claims a refund but has no payout behind it", () => {
    // Two kinds of record land here and neither moved a rupee: one written by
    // the old code, which never called a gateway at all, and one written by
    // `requestRefund`, which stores the full order total with no payment check.
    //
    // Reading either as money already returned made the real refund impossible —
    // `planRefund` saw nothing left, answered `noop`, and the endpoint reported
    // "Order refunded" with a 200. Merely REQUESTING a refund was enough to make
    // the refund unperformable.
    expect(totalRefunded(record({ status: "completed", amount: 1000, reference: "REF-20250101" }))).toBe(0);
    expect(totalRefunded(record({ status: "requested", amount: 1000 }))).toBe(0);
  });

  it("lets a legacy 'refunded' order still be refunded for real", () => {
    const legacy = record({ status: "completed", amount: 1000, reference: "REF-20250101" });
    const plan = planRefund({
      paymentMethod: "razorpay",
      status: "refunded",
      orderTotal: 1000,
      paymentReference: "pay_ABC",
      refundRecord: legacy,
      // Razorpay's own figure: nothing has ever been refunded against it.
      gatewayRefundable: 1000,
    });
    expect(plan).toEqual({ kind: "gateway", amount: 1000 });
  });
});

describe("planRefund", () => {
  const base = {
    paymentMethod: "razorpay",
    status: "confirmed",
    orderTotal: 1000,
    paymentReference: "pay_ABC",
    gatewayRefundable: 1000,
  };

  it("refunds the whole remaining amount when none is named", () => {
    expect(planRefund(base)).toEqual({ kind: "gateway", amount: 1000 });
  });

  it("ACCUMULATES partial refunds instead of replacing them", () => {
    // The old code stored only the latest amount and flipped the order to
    // `refunded` on the first partial, so the remaining 800 could never be paid
    // back through this endpoint at all.
    const afterFirst = planRefund({
      ...base,
      refundRecord: record({ gatewayRefunds: [gatewayRefund({ amount: 200 })] }),
      gatewayRefundable: 800,
      requestedAmount: 300,
    });
    expect(afterFirst).toEqual({ kind: "gateway", amount: 300 });
  });

  it("is a no-op once the order is fully refunded", () => {
    const plan = planRefund({
      ...base,
      refundRecord: record({ gatewayRefunds: [gatewayRefund({ amount: 1000 })] }),
      gatewayRefundable: 0,
    });
    expect(plan.kind).toBe("noop");
  });

  it("never refunds more than the gateway says is left", () => {
    // Our stored total can be a forgery on orders placed before payment
    // verification existed. The gateway's figure is what was really collected.
    const plan = planRefund({ ...base, gatewayRefundable: 250, requestedAmount: 900 });
    expect(plan).toEqual({ kind: "gateway", amount: 250 });
  });

  it("refuses when the gateway reports nothing refundable", () => {
    const plan = planRefund({ ...base, gatewayRefundable: 0 });
    expect(plan.kind).toBe("refuse");
    expect(plan.kind === "refuse" && plan.retryable).toBe(false);
  });

  it("refuses RETRYABLY when the gateway could not be reached", () => {
    // The distinction matters: unreachable must not be read as "nothing to
    // refund", or an outage silently refuses a legitimate refund forever.
    const plan = planRefund({ ...base, gatewayRefundable: null });
    expect(plan.kind).toBe("refuse");
    expect(plan.kind === "refuse" && plan.retryable).toBe(true);
  });

  it("refuses an online order with no payment reference", () => {
    const plan = planRefund({ ...base, paymentReference: undefined });
    expect(plan.kind).toBe("refuse");
  });

  it("refuses a COD order that was never delivered", () => {
    // No cash ever changed hands, so a refund would invent an outgoing payment
    // to match an incoming one that never happened.
    const plan = planRefund({
      ...base,
      paymentMethod: "cod",
      status: "confirmed",
      paymentReference: undefined,
      gatewayRefundable: null,
    });
    expect(plan.kind).toBe("refuse");
    expect(plan.kind === "refuse" && plan.retryable).toBe(false);
  });

  it("allows a delivered COD order as an OFFLINE refund", () => {
    const plan = planRefund({
      ...base,
      paymentMethod: "cod",
      status: "delivered",
      paymentReference: undefined,
      gatewayRefundable: null,
    });
    expect(plan).toEqual({ kind: "offline", amount: 1000 });
  });
});

describe("deriveRefundStatus", () => {
  it("is only completed once the gateway says processed", () => {
    // "completed" used to be written the moment the admin clicked, before the
    // gateway had been asked for anything at all.
    expect(deriveRefundStatus([gatewayRefund({ status: "pending" })], false)).toBe("processing");
    expect(deriveRefundStatus([gatewayRefund({ status: "processed" })], false)).toBe("completed");
  });

  it("is rejected when every attempt failed", () => {
    expect(deriveRefundStatus([gatewayRefund({ status: "failed" })], false)).toBe("rejected");
  });

  it("treats cash handed back as settled — no gateway can confirm it", () => {
    expect(deriveRefundStatus([], true)).toBe("completed");
  });
});

describe("isFullyRefunded", () => {
  it("tolerates rupee-scale float error", () => {
    expect(isFullyRefunded(1000, 999.999)).toBe(true);
    expect(isFullyRefunded(1000, 999.5)).toBe(false);
  });
});

// ---- What the reports are allowed to call refunded -------------------------

function order(over: Partial<PlacedOrder> = {}): PlacedOrder {
  return {
    id: "o1",
    orderNumber: "BK-1",
    items: [],
    totals: { total: 1000, subtotal: 1000, itemCount: 1 },
    address: { fullName: "A", email: "a@b.c", phone: "1", addressLine1: "x", city: "y", state: "z", pincode: "1" },
    paymentMethod: "razorpay",
    paymentStatus: "paid",
    placedAt: "2026-01-01T00:00:00.000Z",
    status: "confirmed",
    statusHistory: [],
    estimatedDelivery: "2026-01-02T00:00:00.000Z",
    ...over,
  } as unknown as PlacedOrder;
}

describe("settledRefundAmount", () => {
  it("counts only what the gateway confirmed paying out", () => {
    expect(
      settledRefundAmount(
        order({
          refundRecord: record({
            gatewayRefunds: [
              gatewayRefund({ id: "a", amount: 200, status: "processed" }),
              gatewayRefund({ id: "b", amount: 300, status: "pending" }),
              gatewayRefund({ id: "c", amount: 400, status: "failed" }),
            ],
          }),
        }),
      ),
    ).toBe(200);
  });

  it("ignores a refund that was only REQUESTED", () => {
    // `requestRefund` writes a record at the full order total with no payment
    // check at all. Counting it put the value of never-paid cancelled COD orders
    // into a card labelled as refunded money.
    expect(
      settledRefundAmount(order({ refundRecord: record({ status: "requested", amount: 1000 }) })),
    ).toBe(0);
  });
});

describe("a COD order that was delivered and then refunded", () => {
  // `isCollectedMoney` tested `status === "delivered"`, and refunding flips the
  // order to `refunded` — so the cash that HAD arrived stopped counting as
  // collected while still counting as a refund. Numerator and denominator in
  // different populations.
  const codRefunded = order({
    paymentMethod: "cod",
    paymentStatus: "refunded",
    status: "refunded",
    statusHistory: [
      { status: "confirmed", at: "2026-01-01T00:00:00.000Z" },
      { status: "delivered", at: "2026-01-01T06:00:00.000Z" },
      { status: "refunded", at: "2026-01-01T09:00:00.000Z" },
    ],
    refundRecord: record({
      offline: true,
      status: "completed",
      amount: 1000,
    }),
  } as unknown as Partial<PlacedOrder>);

  it("cannot report a refund rate above 100%", () => {
    const analytics = getPaymentAnalytics(
      [codRefunded],
      "Asia/Kolkata",
      Date.parse("2026-01-02T12:00:00.000Z"),
    );
    expect(analytics.refundRate).toBeLessThanOrEqual(100);
    expect(analytics.refundRate).toBe(100);
  });

  it("still counts the order as one that collected money", () => {
    const analytics = getPaymentAnalytics(
      [codRefunded],
      "Asia/Kolkata",
      Date.parse("2026-01-02T12:00:00.000Z"),
    );
    // The cash arrived and then went back: one collected order, net zero.
    expect(analytics.collectedOrders).toBe(1);
    expect(analytics.totalCollection).toBe(0);
    expect(analytics.refundAmount).toBe(1000);
  });
});

describe("when COD cash counts as arriving", () => {
  it("buckets it on the DELIVERY day, not the order day", () => {
    // Cash does not exist until the rider is handed it. Bucketing by placedAt
    // put Friday's cash into Monday — missing from "Today's collection" on the
    // day it was actually collected.
    const codDelivered = order({
      paymentMethod: "cod",
      paymentStatus: "cod",
      status: "delivered",
      placedAt: "2026-01-01T05:00:00.000Z",
      statusHistory: [
        { status: "confirmed", at: "2026-01-01T05:00:00.000Z" },
        { status: "delivered", at: "2026-01-05T05:00:00.000Z" },
      ],
    } as unknown as Partial<PlacedOrder>);

    // "Today" is the 5th — delivery day.
    const onDelivery = getPaymentAnalytics(
      [codDelivered],
      "Asia/Kolkata",
      Date.parse("2026-01-05T12:00:00.000Z"),
    );
    expect(onDelivery.todayCollection).toBe(1000);
    expect(onDelivery.todayCount).toBe(1);

    // "Today" is the 1st — the order exists but no cash has changed hands.
    const onOrderDay = getPaymentAnalytics(
      [codDelivered],
      "Asia/Kolkata",
      Date.parse("2026-01-01T12:00:00.000Z"),
    );
    expect(onOrderDay.todayCollection).toBe(0);
  });
});

describe("payment analytics after a refund", () => {
  it("subtracts only the refunded part, not the whole order", () => {
    // A refunded order used to drop out of the success set entirely, so a 200
    // refund on a 1000 order removed 1000 from collection while the refund card
    // beside it reported 200.
    const analytics = getPaymentAnalytics(
      [
        order({
          refundRecord: record({ gatewayRefunds: [gatewayRefund({ amount: 200 })] }),
        }),
      ],
      "Asia/Kolkata",
      Date.parse("2026-01-01T12:00:00.000Z"),
    );

    expect(analytics.totalCollection).toBe(800);
    expect(analytics.refundAmount).toBe(200);
  });

  it("still counts money collected on an order that was later cancelled", () => {
    // `deriveTransactionStatus` tests cancellation before payment, so a paid
    // order an admin cancelled matched no branch and contributed to NOTHING —
    // while the money sat in the gateway account. That is also the mandatory
    // state before a refund can be requested.
    const analytics = getPaymentAnalytics(
      [order({ status: "cancelled", paymentStatus: "paid" })],
      "Asia/Kolkata",
      Date.parse("2026-01-01T12:00:00.000Z"),
    );
    expect(analytics.totalCollection).toBe(1000);
  });

  it("keeps the refund rate a ratio of one population", () => {
    const analytics = getPaymentAnalytics(
      [
        order({ id: "a", refundRecord: record({ gatewayRefunds: [gatewayRefund({ amount: 1000 })] }) }),
        order({ id: "b" }),
      ],
      "Asia/Kolkata",
      Date.parse("2026-01-01T12:00:00.000Z"),
    );
    // Previously the numerator counted refunded orders and the denominator
    // excluded them — two disjoint sets, so this could exceed 100.
    expect(analytics.refundRate).toBeLessThanOrEqual(100);
    expect(analytics.refundRate).toBe(50);
  });
});

// ---- Contracts the endpoints enforce --------------------------------------

describe("refundSchema", () => {
  it("rejects a refund of zero", () => {
    // Zero moved nothing, yet marked the order fully refunded, restored stock
    // and permanently blocked the real refund.
    expect(refundSchema.safeParse({ amount: 0 }).success).toBe(false);
  });

  it("rejects a negative refund", () => {
    expect(refundSchema.safeParse({ amount: -50 }).success).toBe(false);
  });

  it("rejects a reason the Refund Centre's own filter could never match", () => {
    expect(refundSchema.safeParse({ reason: "because i said so" }).success).toBe(false);
    expect(refundSchema.safeParse({ reason: "quality_issue" }).success).toBe(true);
  });

  it("accepts an omitted amount as a full refund", () => {
    expect(refundSchema.safeParse({}).success).toBe(true);
  });
});

describe("statusSchema", () => {
  it("refuses to set refunded or cancelled directly", () => {
    // `updateStatus` writes a status and nothing else — no refund record, no
    // stock, no payment change. Setting these through it produced an order the
    // derived screens could not agree about: a completed payout with no amount
    // on one screen, money still counted as collected on another.
    expect(statusSchema.safeParse({ status: "refunded" }).success).toBe(false);
    expect(statusSchema.safeParse({ status: "cancelled" }).success).toBe(false);
  });

  it("still accepts the fulfilment statuses", () => {
    for (const status of ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered"]) {
      expect(statusSchema.safeParse({ status }).success).toBe(true);
    }
  });
});

describe("timing-safe comparison", () => {
  it("returns false rather than throwing on a non-ASCII signature of equal character length", () => {
    // `timingSafeEqual` throws on a byte-length mismatch. Guarding on
    // `String.length` let a crafted header through to that throw — a 500 on a
    // webhook Razorpay retries, and on the verify endpoint the storefront calls
    // mid-checkout with the customer already charged.
    const expected = "a".repeat(64);
    const crafted = "é".repeat(64);
    expect(expected.length).toBe(crafted.length);
    expect(Buffer.from(crafted, "utf8").length).not.toBe(Buffer.from(expected, "utf8").length);
    expect(() => timingSafeEquals(expected, crafted)).not.toThrow();
    expect(timingSafeEquals(expected, crafted)).toBe(false);
  });

  it("matches an identical string", () => {
    expect(timingSafeEquals("abc123", "abc123")).toBe(true);
  });

  it("rejects an unsigned webhook body", () => {
    expect(verifyWebhookSignature("{}", "", "secret")).toBe(false);
    expect(verifyWebhookSignature("{}", "deadbeef", "")).toBe(false);
  });
});
