/**
 * A customer reviewing a cake the shop itself created.
 *
 * `submitStorefrontReview` resolved the product through `loadProducts()` and
 * gave up when it could not find it. `loadProducts()` reads the ADMIN's
 * localStorage cache and seeds the SHIPPED DEMO catalogue when the key is
 * missing — and it is always missing in a customer's browser, because
 * `useProductCacheSync` runs only in the admin layout.
 *
 * So the check ran against the demo cakes. Every review of a product the shop
 * had actually added was refused before it left the page, with "Could not
 * submit review", for every customer, with no retry that could ever work. The
 * failure was silent to the bakery: no request was ever made.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { submitStorefrontReview } from "@/features/reviews/lib/reviews-repository";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 201,
    json: () =>
      Promise.resolve({ success: true, data: { id: "review-from-server" } }),
  } as Response);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The POST bodies this test caused. */
function submittedBodies() {
  return fetchMock.mock.calls
    .filter((call) => String(call[0]).includes("/api/reviews"))
    .map((call) => JSON.parse((call[1] as RequestInit).body as string));
}

describe("submitting a review from the storefront", () => {
  it("reaches the shop for a product the demo catalogue has never heard of", async () => {
    // A slug the shipped seed does not contain — which is every cake a real
    // bakery adds. localStorage is empty here, exactly as it is for a customer.
    await submitStorefrontReview({
      productSlug: "a-cake-this-shop-invented",
      cakeName: "A Cake This Shop Invented",
      authorName: "Asha",
      rating: 5,
      body: "Wonderful.",
    });

    const sent = submittedBodies();
    expect(sent, "no request was made — the review was dropped in the browser").toHaveLength(1);
    expect(sent[0].productSlug).toBe("a-cake-this-shop-invented");
  });

  it("carries the name the page already knows, so the local row is not blank", async () => {
    await submitStorefrontReview({
      productSlug: "a-cake-this-shop-invented",
      cakeName: "A Cake This Shop Invented",
      authorName: "Asha",
      rating: 5,
      body: "Wonderful.",
    });

    expect(submittedBodies()[0].cakeName).toBe("A Cake This Shop Invented");
  });

  it("does not decide for itself whether the product exists", async () => {
    // The catalogue lives on the server; that is where an unknown slug is
    // refused. A browser-side guess is what produced the bug.
    const source = readFileSync(
      join(process.cwd(), "features/reviews/lib/reviews-repository.ts"),
      "utf8",
    );
    const fn = source.slice(source.indexOf("export function submitStorefrontReview"));
    const body = fn.slice(0, fn.indexOf("\n}"));

    expect(body).not.toContain("loadProducts()");
  });
});

describe("the server resolves the cake instead", () => {
  const service = readFileSync(
    join(process.cwd(), "features/reviews/server/review.service.ts"),
    "utf8",
  );
  const fn = service.slice(service.indexOf("export async function submitReview"));
  const body = fn.slice(0, fn.indexOf("\n}\n"));

  it("looks the product up by slug", () => {
    expect(body).toContain("productRepo.findBySlug(input.productSlug)");
  });

  it("refuses a slug the shop does not sell", () => {
    // The endpoint is public. Without this a review could be filed against a
    // slug the shop has never sold and land in moderation with no product name.
    expect(body).toContain("NotFoundError");
  });

  it("stores the shop's own id and name rather than the caller's", () => {
    expect(body).toContain("cakeId: cake.id");
    expect(body).toContain("cakeName: cake.name");
    expect(body).not.toContain("input.cakeId");
    expect(body).not.toContain("input.cakeName");
  });
});
