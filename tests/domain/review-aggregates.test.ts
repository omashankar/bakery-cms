import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { loadReviews, persistServerReviews } from "@/features/reviews/lib/reviews-repository";
import type { ProductReview } from "@/types/review";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

/**
 * The body of a named function, so an assertion cannot drift into another one.
 *
 * Brace-matched rather than cut at the first `\n}`: a signature like
 * `Promise<{ reviews: ...; persisted: boolean }>` closes a brace before the body
 * has even opened, and the naive version returned the signature alone — an
 * assertion against it fails for the wrong reason, or passes vacuously.
 */
function bodyOf(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`not found: ${signature}`);

  let angle = 0;
  let paren = 0;
  let open = -1;

  for (let i = start + signature.length - 1; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "<") angle += 1;
    else if (ch === ">") angle = Math.max(0, angle - 1);
    else if (ch === "(") paren += 1;
    else if (ch === ")") paren = Math.max(0, paren - 1);
    else if (ch === "{" && angle === 0 && paren === 0) {
      open = i;
      break;
    }
  }
  if (open < 0) throw new Error(`no body found for: ${signature}`);

  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return stripComments(source.slice(start, i + 1));
    }
  }
  throw new Error(`unbalanced body for: ${signature}`);
}

/**
 * Comments removed, because `toContain` cannot tell code from a description of
 * code. Commenting out `await refreshProductRating(...)` left the string in
 * place and the assertion passed — the mutation survived, which is exactly what
 * a vacuous test looks like.
 *
 * Only whole-line `//` comments are stripped, so a `https://` inside a string
 * survives intact.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

/**
 * A product's star rating and review count live on the PRODUCT document, and
 * that is what the storefront renders.
 *
 * They were computed in the browser and written to localStorage, so approving a
 * review changed the moderator's own screen and nothing else. Measured on a real
 * shop before this: 14 of 14 sampled products advertised a score no review
 * supported — one of them "4.9★ from 124 reviews" with no reviews at all.
 */
describe("the advertised rating is computed on the server", () => {
  const service = read("features/reviews/server/review.service.ts");
  const repository = read("features/reviews/server/review.repository.ts");

  it("aggregates over the collection, not over a fetched page", () => {
    const fn = bodyOf(repository, "export async function approvedAggregate(");

    expect(fn).toContain("ReviewModel.aggregate");
    expect(fn).toMatch(/\$match:\s*\{\s*productSlug,\s*status:\s*"approved"\s*\}/);
    // `listAll` caps at 2000. Averaging over that is how the number drifts.
    expect(fn).not.toContain("listAll");
    expect(fn).not.toContain("limit");
  });

  it("returns zeroes rather than skipping a product with nothing approved", () => {
    const fn = bodyOf(repository, "export async function approvedAggregate(");

    // The client version did `if (approved.length === 0) continue;`, which is
    // why rejecting a product's last review left the old score advertised.
    expect(fn).toMatch(/return \{ count: 0, average: 0 \}/);
    expect(fn).not.toContain("continue");
  });

  it("writes the aggregate through a targeted update, not a whole-document write", () => {
    const products = read("features/products/server/product.repository.ts");
    const fn = bodyOf(products, "export async function setReviewAggregate(");

    expect(fn).toContain("ProductModel.updateOne");
    expect(fn).toMatch(/\$set:\s*\{\s*rating:[\s\S]*reviewCount:/);
    // replaceOne here would carry a stale snapshot of every other field.
    expect(fn).not.toContain("replaceOne");
    expect(fn).not.toContain("replaceAll");
  });

  it("refreshes the rating after a moderation change", () => {
    const fn = bodyOf(service, "export async function updateReview(");
    expect(fn).toContain("refreshProductRating(existing.productSlug)");
  });

  it("refreshes the new product too when a review is re-pointed", () => {
    const fn = bodyOf(service, "export async function updateReview(");
    // Otherwise the product it LEFT keeps counting it.
    expect(fn).toMatch(/updated\.productSlug !== existing\.productSlug/);
  });

  it("reads the affected slugs BEFORE deleting the reviews", () => {
    const fn = bodyOf(service, "export async function deleteReviews(");
    const slugsAt = fn.indexOf("slugsForIds");
    const deleteAt = fn.indexOf("deleteMany");

    expect(slugsAt).toBeGreaterThan(-1);
    expect(deleteAt).toBeGreaterThan(-1);
    // Order is the whole point: after the delete there is nothing left to read,
    // and the removed reviews keep counting toward the advertised score.
    expect(slugsAt).toBeLessThan(deleteAt);
    expect(fn).toContain("refreshProductRating(slug)");
  });

  it("repairs shops that are already advertising a wrong score", () => {
    // Wiring the recompute into the write paths only fixes FUTURE moderation.
    const fn = bodyOf(service, "async function ensureAggregatesBackfilled(");
    expect(fn).toContain("refreshProductRating");
    expect(fn).toContain("aggregatesBackfilled.write({ done: true })");

    // And it must be reachable, from an authenticated path.
    expect(bodyOf(service, "export async function getReviews(")).toContain(
      "ensureAggregatesBackfilled()",
    );
    expect(bodyOf(service, "export function getApprovedForProduct(")).not.toContain(
      "ensureAggregatesBackfilled",
    );
  });
});

/**
 * The client repository is a cache. It used to be a generator.
 */
describe("the browser never invents reviews", () => {
  beforeEach(() => localStorage.clear());

  it("returns nothing when the cache is empty", () => {
    // It used to build a list from the product's own rating, signed with names
    // from a sample table — so a moderator who deleted every review watched the
    // fabrication reappear, and a first-time visitor was shown it as fact.
    expect(loadReviews()).toEqual([]);
  });

  it("returns what hydration put there, newest first", () => {
    const rows = [
      { id: "b", productSlug: "x", authorName: "B", rating: 5, body: "b", status: "approved", createdAt: "2026-02-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z" },
      { id: "a", productSlug: "x", authorName: "A", rating: 4, body: "a", status: "approved", createdAt: "2026-03-01T00:00:00.000Z", updatedAt: "2026-03-01T00:00:00.000Z" },
    ] as unknown as ProductReview[];

    persistServerReviews(rows);
    expect(loadReviews().map((review) => review.id)).toEqual(["a", "b"]);
  });

  it("has no sample authors or bodies left to fabricate from", () => {
    const source = read("features/reviews/lib/reviews-repository.ts");
    const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

    expect(code).not.toContain("Priya Sharma");
    expect(code).not.toContain("sampleAuthors");
    expect(code).not.toContain("function seedReviews");
  });
});

/** The storefront's list, and what "Reset" is allowed to mean. */
describe("what customers and moderators actually get", () => {
  it("the storefront asks the server for its reviews", () => {
    const source = read("apps/website/lib/product-details.ts");
    const fn = bodyOf(source, "export async function getProductReviews(");

    expect(fn).toContain("fetchApprovedReviews(cake.slug)");
    // The old path — the visitor's own localStorage.
    expect(fn).not.toContain("getStorefrontReviewsForProduct");
    // A failed read must not be rendered as "no reviews yet".
    expect(fn).toContain("return null");
  });

  it("the reviews screen's reset re-reads instead of deleting", () => {
    const source = read("features/reviews/lib/reviews-repository.ts");
    const fn = bodyOf(source, "export async function reloadReviewsFromServer(");

    expect(fn).toContain("fetchReviews()");
    // It used to delete from the server every review that was not part of a
    // fabricated demo seed — every genuine customer review the shop had — on one
    // unconfirmed click, and then report success.
    expect(fn).not.toContain("deleteReviewsRequest");
    expect(source).not.toContain("export async function resetReviews");
  });

  it("no screen still offers to reset reviews to a demo seed", () => {
    const page = read("apps/admin/reviews/pages/reviews-admin-page.tsx");
    expect(page).not.toContain("Reset demo");
    expect(page).not.toContain("resetReviews");
    expect(page).toContain("reloadReviewsFromServer");
  });
});
