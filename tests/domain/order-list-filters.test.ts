/**
 * These predicates moved from the browser to the server so the refund and
 * invoice lists page through every order rather than the cached recent slice.
 *
 * None of them is expressible as a plain Mongo query — a refund case's status,
 * its reason and its activity date are all derived from `status` and
 * `refundRecord` together — so they stay JS and get pinned here instead.
 */
import { describe, expect, it } from "vitest";

import {
  defaultInvoiceListFilters,
  defaultRefundFilters,
  filterInvoiceOrders,
  filterRefundCases,
  getRefundOverview,
  isRefundCase,
} from "@/features/orders/lib/order-overviews";
import type { PlacedOrder } from "@/features/orders/lib/orders";

const NOW = Date.parse("2026-07-29T12:00:00.000Z");
const DAY = 86_400_000;

function order(overrides: Partial<PlacedOrder> = {}): PlacedOrder {
  return {
    id: "o1",
    orderNumber: "BK-1",
    items: [],
    totals: {
      subtotal: 1000,
      delivery: 0,
      tax: 0,
      discount: 0,
      platformCharge: 0,
      giftWrapFee: 0,
      taxableAmount: 1000,
      total: 1000,
      itemCount: 1,
    },
    address: {
      fullName: "Asha",
      email: "asha@example.com",
      phone: "9999999999",
      addressLine1: "x",
      city: "Mumbai",
      state: "MH",
      pincode: "400001",
    },
    paymentMethod: "upi",
    paymentStatus: "paid",
    placedAt: new Date(NOW).toISOString(),
    status: "delivered",
    statusHistory: [],
    ...overrides,
  } as PlacedOrder;
}

const refundFilters = (patch: Partial<typeof defaultRefundFilters> = {}) => ({
  ...defaultRefundFilters,
  ...patch,
});
const invoiceFilters = (patch: Partial<typeof defaultInvoiceListFilters> = {}) => ({
  ...defaultInvoiceListFilters,
  ...patch,
});

describe("refund case identification", () => {
  it("counts cancelled, refunded and anything carrying a refund record", () => {
    expect(isRefundCase(order({ status: "cancelled" }))).toBe(true);
    expect(isRefundCase(order({ status: "refunded" }))).toBe(true);
    expect(
      isRefundCase(order({ status: "delivered", refundRecord: { status: "requested" } } as Partial<PlacedOrder>))
    ).toBe(true);
    expect(isRefundCase(order({ status: "delivered" }))).toBe(false);
  });
});

describe("filterRefundCases", () => {
  const cases = [
    order({ id: "cancelled", status: "cancelled" }),
    order({ id: "refunded", status: "refunded" }),
    order({
      id: "requested",
      status: "cancelled",
      refundRecord: { status: "requested", reason: "quality_issue", amount: 1000 },
    } as Partial<PlacedOrder>),
    order({ id: "delivered", status: "delivered" }),
  ];

  it("excludes orders that are not refund cases at all", () => {
    const ids = filterRefundCases(cases, refundFilters(), NOW).map((o) => o.id);

    expect(ids).not.toContain("delivered");
    expect(ids).toHaveLength(3);
  });

  it("filters by case type using the DERIVED status, not just order status", () => {
    // "requested" is cancelled at the order level but requested at the refund
    // level — it must answer to the refund status, and to the cancelled tab too.
    const requested = filterRefundCases(cases, refundFilters({ caseType: "requested" }), NOW);
    const cancelled = filterRefundCases(cases, refundFilters({ caseType: "cancelled" }), NOW);

    expect(requested.map((o) => o.id)).toEqual(["requested"]);
    expect(cancelled.map((o) => o.id)).toEqual(["cancelled", "requested"]);
  });

  it("treats a cancelled order with no refund record as reason 'order_cancelled'", () => {
    // The synthetic fallback: nothing on the document carries this value.
    const result = filterRefundCases(cases, refundFilters({ reason: "order_cancelled" }), NOW);

    expect(result.map((o) => o.id)).toEqual(["cancelled"]);
  });

  it("dates off refund activity, not placedAt", () => {
    const old = new Date(NOW - 60 * DAY).toISOString();
    const recentlyRefunded = order({
      id: "old-order-new-refund",
      status: "refunded",
      placedAt: old,
      refundRecord: { status: "completed", amount: 1000, completedAt: new Date(NOW).toISOString() },
    } as Partial<PlacedOrder>);

    // Placed two months ago, refunded today — the 7d tab must still show it.
    const result = filterRefundCases([recentlyRefunded], refundFilters({ dateRange: "7d" }), NOW);

    expect(result).toHaveLength(1);
  });

  it("searches the refund reference and the cancellation reason", () => {
    const withReason = order({
      id: "reasoned",
      status: "cancelled",
      cancellationReason: "Customer moved abroad",
    });

    expect(
      filterRefundCases([withReason], refundFilters({ search: "moved abroad" }), NOW)
    ).toHaveLength(1);
    expect(filterRefundCases([withReason], refundFilters({ search: "zzz" }), NOW)).toHaveLength(0);
  });
});

describe("refund pre-filter safety", () => {
  // The server narrows to refund candidates in Mongo before this runs
  // ({status in [cancelled, refunded]} OR refundRecord exists). That query can
  // only ever return a SUPERSET of what isRefundCase accepts — anything the JS
  // predicate accepts the query also matches — so what makes the optimisation
  // safe is that both consumers re-apply isRefundCase themselves. Pin that.
  const notACase = order({ id: "plain", status: "delivered" });

  it("filterRefundCases drops a non-case that slipped through the pre-filter", () => {
    expect(filterRefundCases([notACase], refundFilters(), NOW)).toEqual([]);
  });

  it("getRefundOverview ignores a non-case in its input", () => {
    const overview = getRefundOverview([notACase, order({ id: "c", status: "cancelled" })]);

    expect(overview.totalCases).toBe(1);
    expect(overview.cancelledCount).toBe(1);
  });

  it("isRefundCase rejects the falsy refundRecord shapes the query could admit", () => {
    // Mongo's {$exists: true, $ne: null} would match a stored `false` or 0 in a
    // Mixed field; Boolean() would not. The JS re-filter is what keeps them out.
    expect(isRefundCase(order({ refundRecord: false } as unknown as Partial<PlacedOrder>))).toBe(
      false
    );
    expect(isRefundCase(order({ refundRecord: 0 } as unknown as Partial<PlacedOrder>))).toBe(
      false
    );
  });
});

describe("getRefundOverview", () => {
  it("counts an order that is both cancelled and refund-requested ONCE", () => {
    // This asserted 2000 — the order appeared in the cancelled bucket and the
    // requested bucket, and pendingAmount summed both. The old comment defended
    // it as preserved behaviour, but there is only one order and only ₹1,000 is
    // owed; a card headed "pending payout" reading twice the money that can
    // possibly go out is not a surprise worth preserving.
    //
    // The per-bucket COUNTS still show it in both, which is right: it is one
    // cancelled case and one requested case.
    const both = order({
      status: "cancelled",
      refundRecord: { status: "requested", reason: "order_cancelled", amount: 1000 },
    } as Partial<PlacedOrder>);

    const overview = getRefundOverview([both]);

    expect(overview.cancelledCount).toBe(1);
    expect(overview.requestedCount).toBe(1);
    expect(overview.pendingAmount).toBe(1000);
  });

  it("counts only what is still OWED, not the order's face value", () => {
    // A ₹5,000 order with ₹200 already paid back has ₹4,800 outstanding. This
    // summed totals.total, so it reported ₹5,000 waiting to go out — including
    // the part that already had.
    const partlyRefunded = order({
      status: "confirmed",
      totals: { total: 5000, subtotal: 5000, itemCount: 1 },
      refundRecord: {
        status: "processing",
        reason: "quality_issue",
        amount: 200,
        history: [],
        gatewayRefunds: [
          { id: "rfnd_1", amount: 200, status: "processed", createdAt: "2026-01-01" },
        ],
      },
    } as unknown as Partial<PlacedOrder>);

    expect(getRefundOverview([partlyRefunded]).pendingAmount).toBe(4800);
  });
});

describe("filterInvoiceOrders", () => {
  const orders = [
    order({ id: "paid", paymentStatus: "paid" }),
    order({ id: "cod", paymentStatus: "cod", status: "confirmed" }),
    order({ id: "old", placedAt: new Date(NOW - 60 * DAY).toISOString() }),
  ];

  it("returns everything with the default filters", () => {
    expect(filterInvoiceOrders(orders, invoiceFilters(), NOW)).toHaveLength(3);
  });

  it("filters by payment status and by order status independently", () => {
    expect(filterInvoiceOrders(orders, invoiceFilters({ payment: "cod" }), NOW)).toHaveLength(1);
    expect(
      filterInvoiceOrders(orders, invoiceFilters({ status: "confirmed" }), NOW)
    ).toHaveLength(1);
  });

  it("dates off placedAt", () => {
    const result = filterInvoiceOrders(orders, invoiceFilters({ dateRange: "30d" }), NOW);

    expect(result.map((o) => o.id)).not.toContain("old");
  });

  it("searches the payment reference as well as the customer", () => {
    const referenced = order({ id: "ref", paymentReference: "UPI-ABC-123" });

    expect(filterInvoiceOrders([referenced], invoiceFilters({ search: "abc-123" }), NOW)).toHaveLength(1);
    expect(filterInvoiceOrders([referenced], invoiceFilters({ search: "asha" }), NOW)).toHaveLength(1);
  });
});

/**
 * "Pending amount" is money the shop OWES BACK.
 *
 * Every cancelled order counted, including a COD order cancelled before
 * delivery — where the customer handed over nothing. A shop that cancels a few
 * COD orders a day read a liability of thousands it does not owe anyone and
 * cannot pay out.
 */
describe("getRefundOverview pending amount", () => {
  it("counts a cancelled order whose payment was captured", () => {
    const paid = order({ id: "paid", status: "cancelled", paymentStatus: "paid" });
    expect(getRefundOverview([paid]).pendingAmount).toBe(1000);
  });

  it("does NOT count a cancelled COD order that never collected a rupee", () => {
    const cod = order({ id: "cod", status: "cancelled", paymentStatus: "cod" });
    expect(getRefundOverview([cod]).pendingAmount).toBe(0);
    // It is still a refund CASE — it just owes nothing.
    expect(getRefundOverview([cod]).cancelledCount).toBe(1);
  });

  it("does not count one whose payment is still pending or failed", () => {
    const pending = order({ id: "p", status: "cancelled", paymentStatus: "pending" });
    const failed = order({ id: "f", status: "cancelled", paymentStatus: "failed" });
    expect(getRefundOverview([pending, failed]).pendingAmount).toBe(0);
  });

  it("still counts what is left on a partly refunded order", () => {
    const partly = order({
      id: "part",
      status: "cancelled",
      paymentStatus: "paid",
      refundRecord: {
        status: "completed",
        reason: "customer_request",
        amount: 400,
        history: [],
        gatewayRefunds: [{ id: "r1", amount: 400, status: "processed", createdAt: "" }],
      },
    } as unknown as Partial<PlacedOrder>);

    expect(getRefundOverview([partly]).pendingAmount).toBe(600);
  });

  it("owes nothing pending on an order that is already refunded", () => {
    // A `refunded` order is in the refunded bucket, not the pending one — the
    // pending set is cancelled + requested + processing.
    const refunded = order({ id: "r", status: "refunded", paymentStatus: "refunded" });
    const overview = getRefundOverview([refunded]);

    expect(overview.pendingAmount).toBe(0);
    expect(overview.refundedCount).toBe(1);
  });

  it("counts a cancelled order already marked payment-refunded", () => {
    // `paymentStatus` can be set on its own through the payment endpoint, so an
    // order can sit in the pending set carrying "refunded" — money that was
    // definitely taken, and whose unsettled part is definitely still owed.
    // Treating that as "never collected" hides a real liability.
    const marked = order({ id: "m", status: "cancelled", paymentStatus: "refunded" });
    expect(getRefundOverview([marked]).pendingAmount).toBe(1000);
  });

  it("still counts an in-flight refund on a paid order", () => {
    // `processing` IS pending — the money has been asked for and not landed.
    const processing = order({
      id: "proc",
      status: "confirmed",
      paymentStatus: "paid",
      refundRecord: {
        status: "processing",
        reason: "customer_request",
        amount: 0,
        history: [],
      },
    } as unknown as Partial<PlacedOrder>);

    expect(getRefundOverview([processing]).pendingAmount).toBe(1000);
  });
});
