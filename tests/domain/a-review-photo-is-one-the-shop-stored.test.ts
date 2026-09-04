import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { submitReviewSchema } from "@/features/reviews/server/review.validators";

/**
 * A review can carry photos, and the endpoint that takes one is public.
 *
 * That is the whole difficulty. `photoUrls` is a list of strings a browser
 * sent, rendered on the busiest page the shop has. Taken at face value it is an
 * arbitrary-image hole: an off-site URL that loads for every visitor, reports
 * their IP to a stranger, and — since the file lives on somebody else's server —
 * can be swapped for something else after a moderator has approved it.
 *
 * So a URL is kept only if this shop's own upload ledger has a row for it.
 * Not a hostname check: the shop's CDN hosts other tenants too, and a folder
 * prefix is a string anybody can type. A row means our uploader produced it,
 * from a file it sniffed, inside the limits that endpoint enforces.
 */

const stored = vi.hoisted(() => ({ urls: [] as string[] }));
const created = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));

vi.mock("@/features/uploads/server/photo-upload.service", () => ({
  findStoredUrls: vi.fn(async (urls: string[]) =>
    new Set(urls.filter((url) => stored.urls.includes(url))),
  ),
}));
vi.mock("@/lib/server/auth/customer-dal", () => ({
  getCustomerAccount: vi.fn(async () => null),
}));
vi.mock("@/features/orders/server/order.repository", () => ({
  findByCustomerEmail: vi.fn(async () => []),
}));
vi.mock("@/features/reviews/server/review.repository", () => ({
  create: vi.fn(async (row: Record<string, unknown>) => {
    created.rows.push(row);
    return row;
  }),
  approvedAggregate: vi.fn(async () => ({ average: 0, count: 0 })),
}));
vi.mock("@/features/products/server/product.repository", () => ({
  findBySlug: vi.fn(async () => ({ id: "p-1", slug: "black-forest", name: "Black Forest" })),
  setReviewAggregate: vi.fn(async () => undefined),
}));
vi.mock("@/lib/server/audit/audit-log", () => ({
  writeAuditLog: vi.fn(async () => undefined),
  requestContext: () => ({ ip: "1.1.1.1", userAgent: "test" }),
}));

const { submitReview } = await import("@/features/reviews/server/review.service");

const CTX = { ip: "1.1.1.1", userAgent: "test" };
const OURS = "https://cdn.example/shop/abc.png";
const THEIRS = "https://tracker.example/pixel.gif";

function submission(photoUrls?: string[]) {
  return {
    productSlug: "black-forest",
    authorName: "Asha",
    rating: 5,
    body: "Lovely.",
    photoUrls,
  } as never;
}

beforeEach(() => {
  stored.urls = [];
  created.rows = [];
});

describe("which photos a review is allowed to carry", () => {
  it("keeps the one this shop stored", async () => {
    stored.urls = [OURS];

    await submitReview(submission([OURS]), CTX);

    expect(created.rows[0]?.photoUrls).toEqual([OURS]);
  });

  it("drops one the shop never issued", async () => {
    /**
     * Silently, and deliberately so. The only way to have an unknown URL here
     * is to have bypassed the uploader, and an error naming the check would
     * tell whoever did that exactly which one they hit.
     */
    stored.urls = [OURS];

    await submitReview(submission([OURS, THEIRS]), CTX);

    expect(created.rows[0]?.photoUrls).toEqual([OURS]);
  });

  it("carries nothing at all when none of them were ours", async () => {
    stored.urls = [];

    await submitReview(submission([THEIRS]), CTX);

    // Undefined, not an empty array: a review with no photos and one whose
    // photos were all refused should read the same everywhere downstream.
    expect(created.rows[0]?.photoUrls).toBeUndefined();
  });

  it("asks nothing of the database when no photos were sent", async () => {
    await submitReview(submission(), CTX);

    expect(created.rows[0]?.photoUrls).toBeUndefined();
  });

  it("counts the same photo once", async () => {
    stored.urls = [OURS];

    await submitReview(submission([OURS, OURS, " " + OURS + " "]), CTX);

    expect(created.rows[0]?.photoUrls).toEqual([OURS]);
  });
});

describe("what the endpoint will even parse", () => {
  it("takes a short list", () => {
    const parsed = submitReviewSchema.safeParse({
      productSlug: "black-forest",
      authorName: "Asha",
      rating: 5,
      body: "Lovely.",
      photoUrls: [OURS],
    });

    expect(parsed.success).toBe(true);
  });

  it("refuses an album", () => {
    // Four is a review. Each photo costs the shop's media plan, and the
    // storage ceiling that protects it is shop-wide.
    const parsed = submitReviewSchema.safeParse({
      productSlug: "black-forest",
      authorName: "Asha",
      rating: 5,
      body: "Lovely.",
      photoUrls: [OURS, OURS, OURS, OURS, OURS],
    });

    expect(parsed.success).toBe(false);
  });
});

describe("where a review photo is seen", () => {
  it("appears with the review on the product page", async () => {
    vi.doMock("next/navigation", () => ({
      useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
      usePathname: () => "/store/cakes/x",
      useSearchParams: () => new URLSearchParams(),
    }));
    vi.doMock("@/features/reviews/lib/reviews-api", () => ({
      fetchApprovedReviews: async () => [
        {
          id: "review-1",
          productSlug: "black-forest",
          cakeName: "Black Forest",
          authorName: "Asha",
          rating: 5,
          body: "Lovely.",
          status: "approved",
          isFeatured: false,
          photoUrls: [OURS],
          deliveredCity: "Mumbai",
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
        },
      ],
      submitReview: async () => ({ ok: true }),
    }));

    const { ProductDetailPage } = await import("@/apps/website/pages/product-detail-page");
    const { defaultModuleSettings } = await import("@/features/settings/lib/settings-utils");

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(ProductDetailPage, {
          cake: {
            id: "p-1",
            name: "Black Forest",
            slug: "black-forest",
            description: "",
            price: 800,
            image: "/bf.jpg",
            category: "Cakes",
            inStock: true,
            weights: [],
            shapes: [],
            variantGroups: [],
            rating: 5,
            reviewCount: 1,
          },
          modules: defaultModuleSettings,
          related: [],
          catalog: [],
        } as never),
      );
    });

    try {
      const photo = [...container.querySelectorAll("img")].find((image) =>
        (image.getAttribute("src") ?? "").includes("abc.png"),
      );
      expect(photo, "the reviewer's photo never reached the page").toBeTruthy();
      // …and the delivery line beside it, which comes from the same payload.
      expect(container.textContent).toContain("Delivered in Mumbai");
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  });

  it("is on the screen where a moderator approves it", async () => {
    /**
     * A moderator pressing Approve publishes whatever is attached. A photo is
     * the one thing on a review that cannot be skim-read, so if the moderation
     * screen omits it the first person to see it is a customer.
     */
    const fs = await import("node:fs");
    const source = fs.readFileSync("apps/admin/reviews/pages/reviews-admin-page.tsx", "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

    // The GUARD, not merely the words. `toContain("review.photoUrls")` passes
    // for a block whose condition has been replaced by `false` — the strings
    // are still in the file, rendering nothing.
    expect(code).toContain("review.photoUrls?.length ?");
    expect(code).toContain("review.photoUrls.map(");
  });
});
