import { describe, expect, it } from "vitest";

import {
  classForCancellableTick,
  customerCancellation,
  isCancellableClass,
  policyVersion,
  preparationStage,
  preparationStartedAt,
  productAllowsCod,
  refundState,
  strictestClass,
} from "@/features/orders/lib/cancellation-policy";

/**
 * TWO TOGGLES PER PRODUCT — "Order cancel" and "Cash on Delivery" — and the
 * one rule they make: a customer may cancel only while every product in the
 * order allows it and the shop has not started preparing it.
 */

const ON = classForCancellableTick(true);
const OFF = classForCancellableTick(false);

function may(status: string, policyClass = ON, extra: Record<string, unknown> = {}) {
  return customerCancellation({ status, policyClass, ...extra }).allowed;
}

describe("the Order cancel toggle", () => {
  it("ON: cancellable until the shop starts preparing", () => {
    expect(may("pending")).toBe(true);
    expect(may("confirmed")).toBe(true);
    expect(may("preparing")).toBe(false);
    expect(may("ready")).toBe(false);
    expect(may("out_for_delivery")).toBe(false);
    expect(may("delivered")).toBe(false);
  });

  it("goes by the recorded start, even if the status was moved back", () => {
    expect(may("confirmed", ON, { preparationStartedAt: "2026-10-13T10:00:00.000Z" })).toBe(false);
  });

  it("OFF: never cancellable by the customer", () => {
    expect(may("confirmed", OFF)).toBe(false);
  });

  it("a product never toggled reads as ON, and behaves as ON", () => {
    expect(isCancellableClass(undefined)).toBe(true);
    expect(isCancellableClass("standard")).toBe(true);
    expect(may("confirmed", "standard")).toBe(true);
    expect(may("preparing", "standard")).toBe(false);
  });

  it("one product switched off makes the whole order uncancellable", () => {
    expect(strictestClass([ON, OFF])).toBe(OFF);
    expect(strictestClass(["standard", ON])).toBe(ON);
    expect(strictestClass([])).toBe("standard");
  });

  it("nothing is cancelled twice", () => {
    expect(may("cancelled")).toBe(false);
    expect(may("refunded")).toBe(false);
  });
});

describe("where the order is in the kitchen", () => {
  it("is read off the status staff set", () => {
    expect(preparationStage("confirmed")).toBe("not_started");
    expect(preparationStage("preparing")).toBe("in_progress");
    expect(preparationStage("out_for_delivery")).toBe("dispatched");
    expect(preparationStage("cancelled")).toBeNull();
  });

  it("has not started just because the order was placed and paid", () => {
    expect(
      preparationStartedAt({
        statusHistory: [
          { status: "pending", at: "2026-10-13T09:00:00.000Z" },
          { status: "confirmed", at: "2026-10-13T09:00:01.000Z" },
        ],
      }),
    ).toBeUndefined();
  });

  it("started the first time staff moved it into the kitchen — or past it", () => {
    expect(
      preparationStartedAt({
        statusHistory: [
          { status: "confirmed", at: "2026-10-13T09:00:00.000Z" },
          { status: "ready", at: "2026-10-13T11:00:00.000Z" },
        ],
      }),
    ).toBe("2026-10-13T11:00:00.000Z");
  });
});

describe("the Cash on Delivery toggle", () => {
  it("is on until the shop switches it off", () => {
    expect(productAllowsCod({})).toBe(true);
    expect(productAllowsCod({ codAllowed: true })).toBe(true);
    expect(productAllowsCod({ codAllowed: false })).toBe(false);
  });
});

describe("the refund's state", () => {
  it("is Processed only when the gateway said so", () => {
    expect(refundState({})).toBe("not_applicable");
    expect(refundState({ refundRecord: { status: "requested" } })).toBe("pending");
    expect(refundState({ refundRecord: { status: "processing", gatewayRefunds: [{ status: "pending" }] } })).toBe(
      "processing",
    );
    expect(refundState({ refundRecord: { status: "completed", gatewayRefunds: [{ status: "processed" }] } })).toBe(
      "processed",
    );
    // A declined request is not a refund; a refund the bank bounced FAILED.
    expect(refundState({ refundRecord: { status: "rejected" } })).toBe("not_applicable");
    expect(refundState({ refundRecord: { status: "rejected", gatewayRefunds: [{ status: "failed" }] } })).toBe(
      "failed",
    );
  });
});

describe("the policy copy on an order", () => {
  it("gets a new version when the wording or any line's toggle changes", () => {
    const base = policyVersion("Text.", [{ productSlug: "cake", policyClass: ON }]);
    expect(policyVersion("Text.", [{ productSlug: "cake", policyClass: ON }])).toBe(base);
    expect(policyVersion("Text!", [{ productSlug: "cake", policyClass: ON }])).not.toBe(base);
    expect(policyVersion("Text.", [{ productSlug: "cake", policyClass: OFF }])).not.toBe(base);
  });
});
