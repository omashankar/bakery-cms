import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { orderStatusTransitionError } from "@/features/orders/lib/order-status-meta";
import type { OrderStatus } from "@/features/orders/lib/orders";

const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

function bodyOf(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`not found: ${signature}`);
  const rest = source.slice(start);
  return stripComments(rest.slice(0, rest.indexOf("\n}")));
}

/**
 * There was no transition rule on the write path at all.
 *
 * `updateStatus` only skipped a no-op, and the single place the terminal rule
 * existed was a `disabled` prop on the detail page's dropdown —
 * `isTerminalOrderStatus` had no server-side caller. The Orders list gives every
 * row a checkbox including under the Cancelled and Refunded tabs, so select-all
 * → bulk status → Apply wrote a refunded order back to `delivered`.
 */
describe("an order climbs the fulfilment ladder and never descends", () => {
  const ladder: OrderStatus[] = [
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "out_for_delivery",
    "delivered",
  ];

  it("allows each step forward", () => {
    for (let i = 0; i < ladder.length - 1; i += 1) {
      expect(orderStatusTransitionError(ladder[i], ladder[i + 1])).toBeNull();
    }
  });

  it("allows skipping a rung a shop does not use", () => {
    // A bakery that never marks "ready" should not have to click through it.
    expect(orderStatusTransitionError("confirmed", "out_for_delivery")).toBeNull();
    expect(orderStatusTransitionError("pending", "delivered")).toBeNull();
  });

  it("refuses every step backward", () => {
    // Each step has already told the customer something. Moving
    // `out_for_delivery` back and forward sends the "on its way" email twice.
    for (let i = 1; i < ladder.length; i += 1) {
      for (let j = 0; j < i; j += 1) {
        expect(
          orderStatusTransitionError(ladder[i], ladder[j]),
          `${ladder[i]} -> ${ladder[j]} must be refused`,
        ).toMatch(/cannot go back/);
      }
    }
  });

  it("treats a no-op as allowed", () => {
    expect(orderStatusTransitionError("preparing", "preparing")).toBeNull();
  });
});

describe("cancelled and refunded are the end", () => {
  const settable: OrderStatus[] = [
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "out_for_delivery",
    "delivered",
  ];

  it("nothing may leave a cancelled order", () => {
    for (const to of settable) {
      expect(orderStatusTransitionError("cancelled", to)).toMatch(/cannot be changed/);
    }
  });

  it("nothing may leave a refunded order", () => {
    // This is the one that cost money: a refunded order written back to
    // `delivered` re-entered the Revenue card having already been paid back.
    for (const to of settable) {
      expect(orderStatusTransitionError("refunded", to)).toMatch(/cannot be changed/);
    }
  });

  it("a refunded order cannot be cancelled either, which would restore its stock again", () => {
    expect(orderStatusTransitionError("refunded", "cancelled")).toMatch(/cannot be changed/);
    expect(orderStatusTransitionError("cancelled", "refunded")).toMatch(/cannot be changed/);
  });

  it("says which status the order is in, so the admin knows why", () => {
    expect(orderStatusTransitionError("refunded", "delivered")).toContain("refunded");
    expect(orderStatusTransitionError("cancelled", "preparing")).toContain("cancelled");
  });
});

describe("the rule is enforced where it counts", () => {
  it("the service refuses before writing anything", () => {
    const fn = bodyOf(read("features/orders/server/order.service.ts"), "export async function updateStatus(");

    expect(fn).toContain("orderStatusTransitionError(order.status, status)");
    expect(fn).toContain("if (refusal) throw new AppError(refusal, 409)");

    // Before the write and before the emails, not after.
    expect(fn.indexOf("orderStatusTransitionError")).toBeLessThan(fn.indexOf("repo.patch"));
  });

  it("the screen does not offer an action the server will refuse", () => {
    const page = stripComments(read("apps/admin/commerce/pages/orders-list-page.tsx"));

    expect(page).toContain("isTerminalOrderStatus(order.status)");
    // Disabled, not merely guarded in the handler — and it says why.
    expect(page).toContain("disabled={applying || lockedSelection.length > 0}");
    expect(page).toContain("cannot be changed");
  });

  it("the handler refuses too, so a stale render cannot slip through", () => {
    const fn = bodyOf(
      read("apps/admin/commerce/pages/orders-list-page.tsx"),
      "async function handleBulkStatusUpdate(",
    );
    expect(fn).toMatch(/lockedSelection\.length > 0/);
    expect(fn.indexOf("lockedSelection.length > 0")).toBeLessThan(fn.indexOf("bulkUpdateOrderStatus"));
  });
});
