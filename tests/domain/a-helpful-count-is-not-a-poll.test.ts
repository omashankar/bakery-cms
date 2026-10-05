import { describe, expect, it, vi } from "vitest";

/**
 * The button that raises a helpful count is PUBLIC and takes an id from the URL.
 *
 * Two things follow, and neither is obvious from the feature as described. The
 * id names a row a stranger chose, so the write has to refuse anything that is
 * not an approved review — otherwise the endpoint can bump a review still in
 * moderation, or one a moderator rejected, neither of which anybody can see to
 * have found helpful. And a refusal has to look the same as a missing review,
 * so the same id cannot be used to ask whether a pending review exists.
 */

const repo = vi.hoisted(() => ({
  incrementHelpful: vi.fn<(id: string) => Promise<number | null>>(),
}));

vi.mock("@/features/reviews/server/review.repository", () => repo);
vi.mock("@/features/products/server/product.repository", () => ({
  findBySlug: vi.fn(async () => null),
  setReviewAggregate: vi.fn(async () => undefined),
}));
vi.mock("@/lib/server/audit/audit-log", () => ({
  writeAuditLog: vi.fn(async () => undefined),
  requestContext: () => ({ ip: "1.1.1.1", userAgent: "test" }),
}));

const { markReviewHelpful } = await import("@/features/reviews/server/review.service");

describe("counting a reader who found a review helpful", () => {
  it("returns the count the database settled on", async () => {
    repo.incrementHelpful.mockResolvedValue(4);

    await expect(markReviewHelpful("review-1")).resolves.toEqual({ helpfulCount: 4 });
    expect(repo.incrementHelpful).toHaveBeenCalledWith("review-1");
  });

  it("refuses anything the repository would not count", async () => {
    /**
     * `incrementHelpful` matches on `status: "approved"`, so null here means
     * either "no such review" or "not one the public can see" — and the caller
     * gets the same answer for both, deliberately.
     */
    repo.incrementHelpful.mockResolvedValue(null);

    await expect(markReviewHelpful("review-pending")).rejects.toThrow(/not found/i);
  });

  it("does not treat a count of zero as a refusal", async () => {
    // Defensive: `?? 0` in the repository can legitimately answer 0 for a row
    // whose counter has never been set, and `if (!count)` would turn that into
    // a 404 on the very first press.
    repo.incrementHelpful.mockResolvedValue(0);

    await expect(markReviewHelpful("review-1")).resolves.toEqual({ helpfulCount: 0 });
  });
});
