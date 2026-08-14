import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { getCustomerActivity } from "@/apps/admin/commerce/lib/customer-profile-utils";
import type { PlacedOrder } from "@/features/orders/lib/orders";

function codeOf(relative: string): string {
  return readFileSync(path.join(process.cwd(), relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

const PLACED = "2026-01-10T09:00:00.000Z";
const CANCELLED = "2026-06-02T15:30:00.000Z";

function order(over: Partial<PlacedOrder> = {}): PlacedOrder {
  return {
    id: "o1",
    orderNumber: "BK-1",
    items: [],
    totals: { subtotal: 100, total: 100, itemCount: 1 },
    address: { fullName: "A", email: "a@b.c", phone: "1", city: "Mumbai" },
    paymentMethod: "cod",
    paymentStatus: "pending",
    placedAt: PLACED,
    status: "confirmed",
    statusHistory: [{ status: "confirmed", at: PLACED }],
    ...over,
  } as PlacedOrder;
}

const meta = { email: "a@b.c", tags: [], notes: "", marketingOptIn: true, updatedAt: PLACED };

/**
 * A timeline's whole job is sequence.
 *
 * The cancellation entry was dated `order.placedAt`, so it always sorted beside
 * the order it undid rather than where it happened. An order placed in January
 * and cancelled in June read as cancelled in January, and everything in between
 * looked like it came afterwards.
 */
describe("the customer timeline dates a cancellation when it happened", () => {
  it("uses the status history entry, not the placed date", () => {
    const timeline = getCustomerActivity(
      meta,
      [
        order({
          status: "cancelled",
          statusHistory: [
            { status: "confirmed", at: PLACED },
            { status: "cancelled", at: CANCELLED },
          ],
        }),
      ],
    );

    const entry = timeline.find((item) => item.type === "order_cancelled");
    expect(entry?.at).toBe(CANCELLED);
    expect(entry?.at).not.toBe(PLACED);
  });

  it("takes the LAST cancellation, if an order was cancelled more than once", () => {
    const later = "2026-08-01T10:00:00.000Z";
    const timeline = getCustomerActivity(
      meta,
      [
        order({
          status: "cancelled",
          statusHistory: [
            { status: "cancelled", at: CANCELLED },
            { status: "confirmed", at: "2026-07-01T10:00:00.000Z" },
            { status: "cancelled", at: later },
          ],
        }),
      ],
    );

    expect(timeline.find((item) => item.type === "order_cancelled")?.at).toBe(later);
  });

  it("falls back to the placed date when the history has no entry", () => {
    // Legacy rows written before the history was recorded must still appear.
    const timeline = getCustomerActivity(
      meta,
      [order({ status: "cancelled", statusHistory: [] })],
    );

    expect(timeline.find((item) => item.type === "order_cancelled")?.at).toBe(PLACED);
  });
});

/**
 * `refundedAt` sat on the unclaimed-payment model, and in its record type, with
 * NO writer and no reader.
 *
 * So the only way off the operator's alert was to attach an order — and a
 * payment that has been refunded can never have one. The money went back, and
 * the row stayed there forever, counted in the total.
 */
describe("an unclaimed payment can be settled by refunding it", () => {
  const repository = codeOf("features/payments/server/unclaimed-payment.repository.ts");

  it("has a writer", () => {
    expect(repository).toContain("export async function markUnclaimedPaymentRefunded");
    expect(repository).toMatch(/\$set: \{ refundedAt: new Date\(\)\.toISOString\(\) \}/);
  });

  it("claims it once — a second click changes nothing", () => {
    const start = repository.indexOf("export async function markUnclaimedPaymentRefunded");
    const fn = repository.slice(start, repository.indexOf("\n}", start));

    expect(fn).toContain("refundedAt: null");
    expect(fn).toContain("(res.modifiedCount ?? 0) > 0");
  });

  it("drops refunded rows from the list", () => {
    const start = repository.indexOf("export async function listUnclaimedPayments");
    const fn = repository.slice(start, repository.indexOf("\n}", start));
    expect(fn).toContain("resolvedByOrderId: null, refundedAt: null");
  });

  it("drops them from the alert's total too", () => {
    // The list and the total disagreeing is its own bug.
    const start = repository.indexOf("export async function unclaimedPaymentTotal");
    const fn = repository.slice(start, repository.indexOf("\n}", start));
    expect(fn).toContain("resolvedByOrderId: null, refundedAt: null");
  });

  it("the endpoint requires an admin and records who did it", () => {
    const route = codeOf("app/api/payments/unclaimed/[id]/refunded/route.ts");
    expect(route).toContain("requireAdminResponse()");
    expect(route).toContain("payment.unclaimed.refunded");
    // A no-op must not answer 200.
    expect(route).toContain("status: 409");
  });

  it("the alert clears the row only on the server's answer", () => {
    const component = codeOf("apps/admin/commerce/components/unclaimed-payments-alert.tsx");
    expect(component).toContain("if (res.ok) setReloadKey");
    // Removing it optimistically would hide money from the one alert that exists
    // to make it impossible to miss.
    expect(component).not.toMatch(/setItems\(\(prev\) => prev\.filter/);
  });
});
