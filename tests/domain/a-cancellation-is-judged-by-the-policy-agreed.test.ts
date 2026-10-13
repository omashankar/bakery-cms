import { describe, expect, it } from "vitest";

import {
  CUSTOMER_CANCELLATION_REASONS,
  EXCEPTION_REASONS,
  evaluateCancellation,
  policyVersion,
  preparationStage,
  preparationStartedAt,
  refundState,
  strictestClass,
  type CancellationClass,
  type CancellationReason,
  type PreparationStage,
} from "@/features/orders/lib/cancellation-policy";

/**
 * A CANCELLATION IS JUDGED BY THE POLICY THE CUSTOMER AGREED TO — and a
 * genuine problem is never refused by it.
 *
 * The shop sells more than cakes. A boxed candle can be cancelled until it
 * leaves; a cake baked to one customer's order cannot be resold once it is in
 * the oven; a photo cake cannot be resold at all. These pin each case, and
 * pin that a wrong, damaged or undelivered order goes to a person whatever the
 * class and whatever the stage.
 */

function judge(policyClass: CancellationClass, stage: PreparationStage | null, reason: CancellationReason, startedAt?: string) {
  return evaluateCancellation({ policyClass, stage, startedAt, reason }).eligibility;
}

describe("a made-to-order cake", () => {
  it("can be cancelled with a full refund before preparation starts", () => {
    expect(judge("made_to_order", "not_started", "changed_mind")).toBe("eligible");
  });

  it("is not refundable for a change of mind once preparation has started", () => {
    expect(judge("made_to_order", "in_progress", "changed_mind")).toBe("non_refundable");
    expect(judge("made_to_order", "ready", "changed_mind")).toBe("non_refundable");
  });

  it("goes by the recorded start, even if the status was moved back", () => {
    // Staff set Preparing at 10:00, then the status was corrected; the kitchen
    // still started.
    expect(judge("made_to_order", "not_started", "changed_mind", "2026-10-13T10:00:00.000Z")).toBe(
      "non_refundable",
    );
  });

  it("cannot be cancelled for a change of plan once it has been dispatched", () => {
    expect(judge("made_to_order", "dispatched", "changed_mind")).toBe("not_allowed");
    expect(judge("made_to_order", "delivered", "ordered_by_mistake")).toBe("not_allowed");
  });
});

describe("the other products in the shop", () => {
  it("a standard item can be cancelled until it is dispatched", () => {
    expect(judge("standard", "not_started", "changed_mind")).toBe("eligible");
    expect(judge("standard", "in_progress", "changed_mind")).toBe("eligible");
    expect(judge("standard", "ready", "changed_mind")).toBe("eligible");
    expect(judge("standard", "dispatched", "changed_mind")).toBe("not_allowed");
  });

  it("a personalised item is not refundable for a change of mind, even before it starts", () => {
    expect(judge("non_cancellable", "not_started", "changed_mind")).toBe("non_refundable");
  });

  it("a mixed cart is judged by its strictest line", () => {
    expect(strictestClass(["standard", "made_to_order"])).toBe("made_to_order");
    expect(strictestClass(["standard", "non_cancellable", "made_to_order"])).toBe("non_cancellable");
    expect(strictestClass([undefined, "standard"])).toBe("standard");
    expect(strictestClass([])).toBe("standard");
  });
});

describe("a problem that may be the shop's", () => {
  it("is always sent to a person — any class, any stage, even after delivery", () => {
    const classes: CancellationClass[] = ["standard", "made_to_order", "non_cancellable"];
    const stages: PreparationStage[] = ["not_started", "in_progress", "ready", "dispatched", "delivered"];
    const verdicts = new Set<string>();
    for (const reason of EXCEPTION_REASONS) {
      for (const cls of classes) {
        for (const stage of stages) verdicts.add(judge(cls, stage, reason, "2026-10-13T10:00:00.000Z"));
      }
    }
    expect([...verdicts]).toEqual(["exception_review"]);
  });

  it("the customer cannot claim the shop's own reason", () => {
    expect(CUSTOMER_CANCELLATION_REASONS).not.toContain("shop_cannot_fulfil");
    expect(CUSTOMER_CANCELLATION_REASONS).toContain("wrong_item");
  });

  it("nothing is judged on a closed order", () => {
    expect(judge("standard", null, "wrong_item")).toBe("not_allowed");
  });
});

describe("where the order is in the kitchen", () => {
  it("is read off the status staff set", () => {
    expect(preparationStage("pending")).toBe("not_started");
    expect(preparationStage("confirmed")).toBe("not_started");
    expect(preparationStage("preparing")).toBe("in_progress");
    expect(preparationStage("ready")).toBe("ready");
    expect(preparationStage("out_for_delivery")).toBe("dispatched");
    expect(preparationStage("delivered")).toBe("delivered");
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
    // The stored stamp wins over the history.
    expect(
      preparationStartedAt({
        preparationStartedAt: "2026-10-13T10:00:00.000Z",
        statusHistory: [{ status: "ready", at: "2026-10-13T11:00:00.000Z" }],
      }),
    ).toBe("2026-10-13T10:00:00.000Z");
  });
});

describe("the refund's state", () => {
  it("is Processed only when the gateway said so", () => {
    expect(refundState({})).toBe("not_applicable");
    expect(refundState({ refundRecord: { status: "requested" } })).toBe("pending");
    expect(
      refundState({ refundRecord: { status: "processing", gatewayRefunds: [{ status: "pending" }] } }),
    ).toBe("processing");
    expect(
      refundState({ refundRecord: { status: "processing", gatewayRefunds: [{ status: "failed" }] } }),
    ).toBe("failed");
    expect(
      refundState({ refundRecord: { status: "completed", gatewayRefunds: [{ status: "processed" }] } }),
    ).toBe("processed");
    // A declined request is not a refund at all…
    expect(refundState({ refundRecord: { status: "rejected" } })).toBe("not_applicable");
    // …but a refund the bank bounced reads `rejected` on the record too, and
    // that one FAILED.
    expect(
      refundState({ refundRecord: { status: "rejected", gatewayRefunds: [{ status: "failed" }] } }),
    ).toBe("failed");
  });
});

describe("the policy copy on an order", () => {
  it("gets a new version when the wording or any line's class changes", () => {
    const base = policyVersion("No refunds once baked.", [{ productSlug: "cake", policyClass: "made_to_order" }]);
    expect(policyVersion("No refunds once baked.", [{ productSlug: "cake", policyClass: "made_to_order" }])).toBe(base);
    expect(policyVersion("No refunds once baked!", [{ productSlug: "cake", policyClass: "made_to_order" }])).not.toBe(base);
    expect(policyVersion("No refunds once baked.", [{ productSlug: "cake", policyClass: "standard" }])).not.toBe(base);
  });
});
