/**
 * The admin order list moved from filtering a capped client-side array to
 * filtering in Mongo. These pin the query the server builds, because a wrong
 * filter here does not error — it silently returns the wrong orders and the
 * wrong totals, which is exactly the failure mode the move was meant to end.
 */
import { describe, expect, it } from "vitest";

import { buildOrderFilter } from "./order.repository";
import { orderQuerySchema } from "./order.validators";

function query(overrides: Record<string, unknown> = {}) {
  return { page: 1, limit: 10, ...overrides };
}

describe("orderQuerySchema", () => {
  it("defaults to page 1 at the legacy 500-row limit", () => {
    // A bare GET /api/orders must keep returning what the client-side cache
    // hydration has always relied on.
    expect(orderQuerySchema.parse({})).toMatchObject({ page: 1, limit: 500 });
  });

  it("coerces numeric params from the query string", () => {
    const parsed = orderQuerySchema.parse({ page: "3", limit: "25", amountMin: "500" });

    expect(parsed).toMatchObject({ page: 3, limit: 25, amountMin: 500 });
  });

  it("caps limit so one request cannot ask for the whole collection", () => {
    expect(orderQuerySchema.safeParse({ limit: "100000" }).success).toBe(false);
  });

  it("rejects an unknown status rather than ignoring it", () => {
    expect(orderQuerySchema.safeParse({ status: "teleported" }).success).toBe(false);
  });
});

describe("buildOrderFilter", () => {
  it("is empty when nothing is filtered", () => {
    expect(buildOrderFilter(query())).toEqual({});
  });

  it("matches a single status", () => {
    expect(buildOrderFilter(query({ status: "delivered" }))).toEqual({
      status: { $in: ["delivered"] },
    });
  });

  it("intersects status with the delivery filter instead of letting one win", () => {
    // The admin list applies both at once; "delivered" is not in the
    // in_progress set, so the correct answer is "nothing matches".
    expect(
      buildOrderFilter(query({ status: "delivered", deliveryStatus: "in_progress" }))
    ).toEqual({ status: { $in: [] } });
  });

  it("keeps the overlap when status and delivery filter agree", () => {
    expect(buildOrderFilter(query({ status: "ready", deliveryStatus: "in_progress" }))).toEqual({
      status: { $in: ["ready"] },
    });
  });

  it("expands a delivery filter on its own", () => {
    expect(buildOrderFilter(query({ deliveryStatus: "in_transit" }))).toEqual({
      status: { $in: ["out_for_delivery"] },
    });
  });

  it("builds an amount range from either bound", () => {
    expect(buildOrderFilter(query({ amountMin: 500 }))["totals.total"]).toEqual({ $gte: 500 });
    expect(buildOrderFilter(query({ amountMax: 900 }))["totals.total"]).toEqual({ $lte: 900 });
    expect(buildOrderFilter(query({ amountMin: 500, amountMax: 900 }))["totals.total"]).toEqual({
      $gte: 500,
      $lte: 900,
    });
  });

  it("turns a date range into an ISO lower bound", () => {
    const placedAt = buildOrderFilter(query({ dateRange: "7d" })).placedAt as { $gte: string };
    const cutoff = new Date(placedAt.$gte).getTime();
    const expected = Date.now() - 7 * 86_400_000;

    expect(Math.abs(cutoff - expected)).toBeLessThan(5_000);
  });

  it("searches across order number, name, email and phone", () => {
    const or = buildOrderFilter(query({ search: "asha" })).$or as Array<Record<string, unknown>>;

    expect(or.map((clause) => Object.keys(clause)[0])).toEqual([
      "orderNumber",
      "address.fullName",
      "address.email",
      "address.phone",
    ]);
  });

  it("escapes regex metacharacters in the search term", () => {
    // Unescaped, ".*" would match every order and "(" would throw inside Mongo.
    const or = buildOrderFilter(query({ search: ".*(" })).$or as Array<{
      orderNumber: { $regex: string };
    }>;

    expect(or[0].orderNumber.$regex).toBe("\\.\\*\\(");
  });
});
