/**
 * Five smaller ways the storefront showed the wrong thing, or nothing at all.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { publishedOnly } from "@/features/content/lib/storefront-content";
import { searchProducts } from "@/features/products/lib/product-catalog";
import { applyCollectionFilters, DEFAULT_COLLECTION_FILTERS } from "@/apps/website/lib/collection-filters";
import type { LandingProduct } from "@/constants/landing-data";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/** Same helper as product-controls-reach-customers.test.ts. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

function cake(overrides: Partial<LandingProduct> = {}): LandingProduct {
  return {
    id: "c1",
    slug: "black-forest",
    name: "Black Forest",
    category: "Cakes",
    // What the CARD projection carries: `toCard` blanks this deliberately.
    description: "",
    image: "",
    price: 750,
    rating: 5,
    inStock: true,
    ...overrides,
  } as unknown as LandingProduct;
}

describe("draft content crossing to the browser", () => {
  it("is dropped before the handoff, not just before the render", () => {
    // The render filtered by status all along; the TRANSPORT did not. Every
    // draft and archived FAQ and testimonial travelled in the RSC payload,
    // readable in the page source — answers to questions the shop had not
    // decided to publish.
    const items = [
      { id: "1", status: "published" },
      { id: "2", status: "draft" },
      { id: "3", status: "archived" },
    ];

    expect(publishedOnly(items).map((item) => item.id)).toEqual(["1"]);
  });

  it("copes with content the database does not have", () => {
    expect(publishedOnly(undefined)).toEqual([]);
    expect(publishedOnly(null)).toEqual([]);
  });

  it("is applied by every server page that hands content to a client component", () => {
    for (const path of [
      "app/(storefront)/store/faq/page.tsx",
      // The homepage's own reads moved here when the builder started sharing
      // them — it is still the one place that hands this content to a client
      // component, so it is still the file that has to filter.
      "apps/website/lib/homepage-render-data.server.ts",
      "apps/website/pages/wedding-page.tsx",
    ]) {
      const source = read(path);
      expect(source, `${path} still ships raw content`).toContain("publishedOnly(");
      expect(source).not.toMatch(/faqs=\{\(faqsRaw \?\? \[\]\)/);
      expect(source).not.toMatch(/testimonials=\{\(testimonialsRaw \?\? \[\]\)/);
    }
  });
});

describe("searching the shop", () => {
  it("matches a flavour, which the card payload actually carries", () => {
    // Search matched name, category and DESCRIPTION — and the storefront's
    // search page runs on the card projection, where the description is blank.
    // A third of the predicate could never match, while the flavours and
    // occasions customers type were sitting unused in the same payload.
    const catalog = [cake({ flavours: ["Butterscotch"] }), cake({ slug: "other", name: "Other" })];

    expect(searchProducts("butterscotch", catalog).map((item) => item.slug)).toEqual([
      "black-forest",
    ]);
  });

  it("matches an occasion", () => {
    const catalog = [cake({ occasions: ["Anniversary"] }), cake({ slug: "other", name: "Other" })];

    expect(searchProducts("anniversary", catalog)).toHaveLength(1);
  });

  it("still matches the name and the category", () => {
    const catalog = [cake()];

    expect(searchProducts("black", catalog)).toHaveLength(1);
    expect(searchProducts("cakes", catalog)).toHaveLength(1);
    expect(searchProducts("nothing-like-this", catalog)).toHaveLength(0);
  });

  it("still matches a description when the caller has real products", () => {
    // `searchProducts` is also called with full products, where the field is
    // real. Dropping it from the haystack would have narrowed those callers.
    const catalog = [cake({ description: "Rich Belgian chocolate layers" })];

    expect(searchProducts("belgian", catalog)).toHaveLength(1);
  });

  it("searches the collections box the same way", () => {
    const catalog = [cake({ flavours: ["Pistachio"] }), cake({ slug: "other", name: "Other" })];

    const shown = applyCollectionFilters(catalog, {
      ...DEFAULT_COLLECTION_FILTERS,
      search: "pistachio",
    });

    expect(shown.map((item) => item.slug)).toEqual(["black-forest"]);
  });
});

describe("the profile form", () => {
  const page = read("apps/website/account/pages/account-dashboard-page.tsx");

  it("does not report a save that did not happen", () => {
    // The write used to go to localStorage and toast "Profile updated"
    // regardless of whether anything was stored.
    expect(page).toContain("const updated = await updateCustomerProfile(");
    expect(page).toContain("if (!updated)");
  });

  it("does not let the customer edit the address their orders are matched on", () => {
    /**
     * Stronger than the warning this used to assert.
     *
     * The first fix explained what editing the email would cost — "orders
     * placed with X stay under that address". Now there is a real account
     * behind the session and the email IS the account: every order is found by
     * matching it, so an edit here could only ever produce an account pointing
     * at a history it no longer has. Moving to another address means signing in
     * as that address and proving it.
     */
    const form = page.slice(page.indexOf('htmlFor="email"'));
    const field = form.slice(0, form.indexOf("</div>"));

    expect(field).toContain("readOnly");
    expect(field).toContain("disabled");
    // And the save payload cannot carry one either.
    const submit = page.slice(page.indexOf("const onSubmit"));
    expect(submit.slice(0, submit.indexOf("toast.success"))).not.toContain("email:");
  });
});

describe("refreshing an order", () => {
  it("does not delete the order from the screen when the request fails", () => {
    // This fell through to the local cache unconditionally, and that cache is
    // empty for any order this browser did not write — a webhook-placed order,
    // or one opened from a tracking link. One failed request turned a loaded
    // order into "Order Not Found".
    const page = read("apps/website/checkout/pages/order-detail-page.tsx");
    const fn = page.slice(page.indexOf("async function refreshOrder"));
    const body = fn.slice(0, fn.indexOf("\n  }"));

    expect(body).not.toContain("setOrder(getOrderByNumber(orderNumber));");
    expect(body).toContain("if (local)");
  });
});

describe("the track-order page", () => {
  it("does not print somebody's real order number as a demo", () => {
    // `getOrders()[0]` is the most recent REAL order in this browser's cache.
    // On a shared device that is the previous customer's.
    const page = read("apps/website/checkout/pages/track-order-page.tsx");

    // Comments stripped first. The note left in that file explains what was
    // removed and names it, and two earlier versions of this test matched the
    // explanation rather than the code.
    const code = stripComments(page);

    expect(code).not.toContain("demoHint");
    expect(code, "the page still reads this browser's order cache").not.toContain("getOrders(");
    // The format is still shown, without quoting anyone's order.
    expect(code).toContain('placeholder="BK-');
  });
});

describe("the footer's wedding link", () => {
  it("is gated like the header's copy of the same link", () => {
    // The default footer ships a "Wedding Cakes" quick link. The navbar gates
    // its own; this one was left, so a shop with the module off kept a link to
    // a 404 on every page.
    const footer = read("apps/website/landing/components/landing-footer.tsx");

    expect(footer).toContain("data-gate-wedding");
    expect(footer).toContain("routes.store.weddingCakes");
  });
});
