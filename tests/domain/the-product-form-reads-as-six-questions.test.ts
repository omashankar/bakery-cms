import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Eight tabs, and the strip scrolled.
 *
 * Three of the eight names were ours rather than the shop's. "Basic" and
 * "Classification" split what a product IS across two tabs — a name here, the
 * category it is filed under there. "Commerce" held four unrelated subjects:
 * stock levels, a flavour list, two customisation ticks and a read-only review
 * score, none of which a shop owner would look for under that word.
 *
 * And "Details" had come to hold exactly one editor, whose own first block is
 * usually headed "Product Details" — two different Details on one screen.
 *
 * Six now, each one a question somebody already asks: what is it, what does it
 * cost and how many are there, what can the customer choose, what does the page
 * say, what does it look like, what does Google see.
 *
 * NOTHING MOVED BETWEEN FIELDS AND STORAGE. Every field is the same field with
 * the same name; only the heading it sits under changed. That is what most of
 * this file checks — a reshuffle that quietly dropped a field would be a far
 * worse bug than the confusion it set out to fix.
 */

const form = readFileSync(
  join(process.cwd(), "apps/admin/products/components/product-form-page.tsx"),
  "utf8",
);

/**
 * The tab a marker sits in, or null when it sits outside every tab.
 *
 * Closing tags are counted as well as opening ones. Taking only the last
 * `<TabsContent value=` before the marker reports "seo" for everything AFTER
 * the tabs — which is where the summary card is, and is exactly the case the
 * read-only pair below is about.
 */
function tabOf(marker: string): string | null {
  const at = form.indexOf(marker);
  if (at < 0) return null;

  let open: string | null = null;
  for (const m of form.slice(0, at).matchAll(/<TabsContent value="([a-z]+)"|<\/TabsContent>/g)) {
    open = m[1] ?? null;
  }
  return open;
}

describe("the tabs", () => {
  it("are the six a shop owner would name", () => {
    const triggers = [...form.matchAll(/<TabsTrigger value="([a-z]+)">([^<]+)</g)].map((m) => ({
      value: m[1],
      label: m[2],
    }));

    expect(triggers.map((t) => t.value)).toEqual([
      "basics",
      "price",
      "options",
      "description",
      "photos",
      "seo",
    ]);
    expect(triggers.map((t) => t.label)).toEqual([
      "Basics",
      "Price &amp; stock",
      "Options",
      "Description",
      "Photos",
      "SEO",
    ]);
  });

  it("no longer carry a name the shop did not choose", () => {
    for (const gone of ["Classification", '>Commerce<', '>Basic<', '>Media<', '>Details<']) {
      expect(form, `${gone} is still a tab`).not.toContain(`<TabsTrigger value="${gone}"`);
    }
    expect(form).not.toContain('value="classification"');
    expect(form).not.toContain('value="commerce"');
  });

  it("open on the first one", () => {
    expect(form).toContain('<Tabs defaultValue="basics">');
  });

  it("have a panel each, and no orphan panel", () => {
    const triggers = [...form.matchAll(/<TabsTrigger value="([a-z]+)"/g)].map((m) => m[1]);
    const panels = [...form.matchAll(/<TabsContent value="([a-z]+)"/g)].map((m) => m[1]);

    expect(panels).toEqual(triggers);
  });
});

describe("every field is still on the form, under the heading it belongs to", () => {
  it("puts what a product IS under Basics", () => {
    for (const field of ['htmlFor="name"', 'htmlFor="slug"']) {
      expect(tabOf(field), field).toBe("basics");
    }
    /**
     * The description is NOT here. It prints as the paragraph under the
     * blocks, so it is edited beside them — and the short description that
     * sat above it is gone entirely, being a second box for the SEO tab's
     * job. Three things called a description; one now.
     */
    expect(tabOf('htmlFor="description"')).toBe("description");
    expect(form).not.toContain('htmlFor="shortDescription"');
    // Category and occasions had a tab of their own called "Classification".
    expect(tabOf('htmlFor="category"')).toBe("basics");
    expect(tabOf("adminOccasions()")).toBe("basics");
  });

  it("puts what it costs and how many under Price & stock", () => {
    for (const field of ['htmlFor="price"', 'htmlFor="compareAtPrice"']) {
      expect(tabOf(field), field).toBe("price");
    }
    // Stock sat under "Commerce", beside a flavour list and a review score.
    expect(tabOf("Unlimited stock")).toBe("price");
    expect(tabOf('htmlFor="stockQuantity"')).toBe("price");
    expect(tabOf('htmlFor="lowStockThreshold"')).toBe("price");
    expect(tabOf("Derived stock status")).toBe("price");
  });

  it("puts everything the customer chooses or adds under Options", () => {
    expect(tabOf("<ProductVariantManager")).toBe("options");
    // All three of these sat under "Commerce".
    expect(tabOf('htmlFor="flavourOptions"')).toBe("options");
    // "Allow {productLower} message on PDP" — an abbreviation only a developer
    // says out loud, built out of the shop word so it read "Allow bouquet message".
    expect(tabOf("Ask for a message")).toBe("options");
    expect(tabOf("Ask for a photo")).toBe("options");
    expect(tabOf('htmlFor="photo-frame-shape"')).toBe("options");
  });

  it("counts the size list as one of the things the customer chooses", () => {
    /**
     * It was on Price & stock, and this test asserted so, because every size
     * row carries a price. That is true and it is the wrong reason: the
     * customer is being asked WHICH SIZE — a question, exactly like colour and
     * gift wrap. A shop met the same job twice, on two screens, in two shapes,
     * and nothing said they were the same job.
     *
     * It sits FIRST in the tab, above the other blocks, because it is the
     * question whose answer the others adjust — and because that is the order
     * the product page draws them in.
     */
    expect(tabOf('htmlFor="weightLabel"')).toBe("options");
    expect(tabOf('id="size-labels-in-use"')).toBe("options");

    expect(
      form.indexOf('htmlFor="weightLabel"'),
      "the size list is below the option blocks",
    ).toBeLessThan(form.indexOf("<ProductVariantManager"));
  });

  it("puts the blocks under Description, and calls the tab that", () => {
    expect(tabOf("<ProductDescriptionBlocksFields")).toBe("description");
  });

  it("keeps photos and SEO where they were", () => {
    expect(tabOf("Main photo")).toBe("photos");
    expect(tabOf('htmlFor="metaTitle"')).toBe("seo");
  });
});

describe("the read-only pair", () => {
  it("is out of the tabs entirely", () => {
    /**
     * Rating and review count are owned by the reviews aggregate — the form
     * shows them disabled and `updateProduct` re-imposes the stored values. A
     * fact about the product, not a field to fill in, and it was sitting in a
     * tab about stock levels.
     */
    expect(tabOf('<span className="text-muted-foreground">Rating:</span>')).toBeNull();
    expect(form).toContain('{form.rating || "No reviews yet"}');
  });

  it("does not print a review count nobody has earned", () => {
    // "Reviews: 0" is a worse thing to show than nothing.
    expect(form).toContain("{form.reviewCount > 0 ? (");
  });
});

describe("the settings that send people here", () => {
  const overview = readFileSync(
    join(process.cwd(), "apps/admin/settings/components/settings-overview-page.tsx"),
    "utf8",
  );

  it("names no trade on the modules card", () => {
    /**
     * "Enable optional bakery features" on a CMS whose whole point is that the
     * business type restricts nothing. The modules file already argues this for
     * `photoCake`: a shop selling frames should not have to switch on something
     * called Photo Cake.
     */
    expect(overview).not.toContain("bakery features");
  });

  it("says what is actually on the Order Settings page", () => {
    /**
     * It read "Gift wrap, minimum order, and free-delivery rules" while the page
     * had grown the delivery information every product page prints and the cards
     * under the product photo. Nobody looking for those would open a card
     * described as order rules.
     */
    const at = overview.indexOf('title: "Order Settings"');
    const card = overview.slice(at, at + 400);

    expect(card).toContain("every product page says about delivery");
  });
});
