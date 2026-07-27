import { describe, expect, it } from "vitest";

import {
  submitReviewSchema,
  updateReviewSchema,
  deleteReviewsSchema,
} from "./review.validators";

describe("review validators", () => {
  it("accepts a valid public submission", () => {
    expect(
      submitReviewSchema.safeParse({
        productSlug: "chocolate-truffle",
        authorName: "Priya",
        rating: 5,
        body: "Delicious!",
      }).success,
    ).toBe(true);
  });

  it("rejects a rating out of range", () => {
    expect(
      submitReviewSchema.safeParse({
        productSlug: "x",
        authorName: "A",
        rating: 6,
        body: "hi",
      }).success,
    ).toBe(false);
  });

  it("rejects a submission without a body", () => {
    expect(
      submitReviewSchema.safeParse({ productSlug: "x", authorName: "A", rating: 4, body: "" }).success,
    ).toBe(false);
  });

  it("accepts a moderation patch and rejects an empty one", () => {
    expect(updateReviewSchema.safeParse({ status: "approved" }).success).toBe(true);
    expect(updateReviewSchema.safeParse({ isFeatured: true }).success).toBe(true);
    expect(updateReviewSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a moderation patch with an invalid status", () => {
    expect(updateReviewSchema.safeParse({ status: "spam" }).success).toBe(false);
  });

  it("validates the bulk delete payload", () => {
    expect(deleteReviewsSchema.safeParse({ ids: ["review-1", "review-2"] }).success).toBe(true);
    expect(deleteReviewsSchema.safeParse({ ids: [] }).success).toBe(false);
  });
});
