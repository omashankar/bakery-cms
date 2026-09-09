import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createEmptyProductForm } from "@/features/products/lib/products-repository";
import { slugify, slugOrFallback } from "@/features/products/lib/product-utils";

/**
 * Four shops were walked through the Add Product form — a phone-accessory shop
 * in Jaipur, a plant nursery, this bakery, and a saree shop whose owner reads
 * English slowly. All four finished. All four shipped the same four mistakes,
 * and not one of them was a mistake the shop made.
 *
 *   The charger, the Snake Plant and the Kanjivaram silk saree were all filed
 *   under "Birthday Cakes", because the category box opened on whatever was
 *   first in the list and therefore looked answered.
 *
 *   All three carried fifty units of stock nobody had counted, and would have
 *   stopped selling on the fifty-first order.
 *
 *   All three asked the buyer for a message — "Message on this order — e.g.
 *   Happy Birthday!" — under a tick reading "Allow product message on PDP".
 *
 *   And a product named in Hindi could not be saved at all: the address box is
 *   filled from the name, `slugify` keeps only [a-z0-9], so मनी प्लांट produced
 *   an empty slug and the save was refused on a field the owner never touched.
 *
 * The common thread is one habit: the form answering a question on the shop's
 * behalf, in a box that then looks filled in. This file is about that habit.
 */

const FORM = "apps/admin/products/components/product-form-page.tsx";
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

describe("a new product starts unanswered", () => {
  const empty = createEmptyProductForm();

  it("is filed nowhere", () => {
    // `adminCategories()[0]?.id ?? "1"` — the first row of whatever taxonomy
    // this browser happened to hold, which on a fresh install is the shipped
    // demo's. Worse than wrong: the server replaces that cache after mount, so
    // the id was often one the shop's real list has never held.
    expect(empty.categoryId).toBe("");
  });

  it("has counted nothing, and is still sellable", () => {
    /**
     * 50 was a number no shop typed, on the field that decides when its product
     * stops selling. Zero is only safe because nothing is being counted:
     * "Unlimited" starts on, so a shop that never opens this tab keeps selling —
     * which is what most of them mean — and unticking it is the act of saying
     * "I sell from a fixed number".
     */
    expect(empty.stockQuantity).toBe(0);
    expect(empty.unlimitedStock).toBe(true);
    expect(empty.stockStatus).toBe("in_stock");
  });

  it("asks the customer for nothing", () => {
    // ON, so every plant, saree and charger this CMS created carried a message
    // box the shop had to find and untick — once per product, for ever.
    expect(empty.allowsMessage).toBe(false);
    expect(empty.allowsPhotoUpload).toBe(false);
  });

  it("and the boxes it does fill are the ones it can answer honestly", () => {
    // Not a retreat into filling nothing in: a draft, no rating, no reviews and
    // no price are all true statements about a product nobody has described yet.
    expect(empty.status).toBe("draft");
    expect(empty.rating).toBe(0);
    expect(empty.price).toBe(0);
  });
});

describe("publishing asks for what publishing needs", () => {
  const form = code(FORM);

  it("refuses a product with no category, and says where the box is", () => {
    expect(form).toContain("if (!form.categoryId.trim()) {");
    expect(form).toContain("Choose a category before publishing");
  });

  it("but lets a half-built one be parked", () => {
    /**
     * The guard is inside `intent === "publish"`, deliberately. A shop that has
     * to go and create a category first must be able to keep what it has typed —
     * and archiving must never become impossible because of where something is
     * filed.
     */
    const at = form.indexOf('if (intent === "publish") {');
    const guard = form.indexOf("if (!form.categoryId.trim())");

    expect(at).toBeGreaterThan(0);
    expect(guard).toBeGreaterThan(at);
    expect(guard).toBeLessThan(form.indexOf("setIsSaving(true)"));
  });

  it("shows an unanswered category as unanswered", () => {
    expect(form).toContain('<option value="">Choose a category…</option>');
  });

  it("and says what to do when there are no categories at all", () => {
    // Every other list on this form explains itself when empty — "No options
    // yet", "No rows means it is sold in one size". This one opened onto
    // nothing, with no way to tell broken from yours-to-set-up.
    expect(form).toContain("adminCategories().length === 0 ?");
    expect(form).toContain("No categories yet. Add them under Catalog");
  });
});

describe("the address box can be typed into", () => {
  const form = code(FORM);

  it("does not eat the separator as it is typed", () => {
    /**
     * `slugify` ran on every keystroke and its last step strips a trailing
     * hyphen — so the separator was deleted the instant it was typed.
     * "chocolate truffle cake" became "chocolatetrufflecake", and a hyphen
     * typed by hand never appeared at all. The box could not be typed into;
     * it could only be watched.
     */
    expect(form).not.toContain("patchForm({ slug: slugify(e.target.value) });");
    expect(form).toContain('slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-")');
  });

  it("tidies it once, when the box is left", () => {
    expect(form).toContain("onBlur={(e) => patchForm({ slug: slugify(e.target.value) })}");
  });

  it("is called what it is, and says what it is for", () => {
    // "URL slug" is two developer words. A shop owner has an address.
    expect(form).toContain(">Web address</Label>");
    expect(form).not.toContain(">URL slug</Label>");
  });
});

describe("a shop can name its products in its own language", () => {
  it("gives a Devanagari name a usable address", () => {
    /**
     * THE one that blocked a save outright. This CMS is sold to Indian shop
     * owners; `slugify` keeps only [a-z0-9], so a product named entirely in
     * Hindi produced an empty slug and the save was refused on a field the
     * owner had never touched and could see nothing wrong with.
     */
    expect(slugify("मनी प्लांट")).toBe("");
    expect(slugOrFallback("मनी प्लांट")).not.toBe("");
  });

  it("gives two different names two different addresses", () => {
    // A single constant fallback would collide on the second product, and the
    // slug is unique in the database — the second save would be refused for a
    // reason even further from anything the shop did.
    expect(slugOrFallback("मनी प्लांट")).not.toBe(slugOrFallback("गुलाब"));
  });

  it("gives the same name the same address every time", () => {
    // Deterministic, so two people typing the same product do not create two
    // rows, and a name retyped after a mistake lands back on its own address.
    expect(slugOrFallback("மல்லிகை")).toBe(slugOrFallback("மல்லிகை"));
  });

  it("leaves a name it CAN read alone", () => {
    expect(slugOrFallback("Chocolate Truffle Cake")).toBe("chocolate-truffle-cake");
    expect(slugOrFallback("")).toBe("");
  });

  it("is what the name box actually uses", () => {
    expect(code(FORM)).toContain("slug: slugTouched ? prev.slug : slugOrFallback(name),");
  });
});

describe("the two ticks say what the customer will see", () => {
  const form = code(FORM);

  it("stops printing an abbreviation only a developer says out loud", () => {
    expect(form).not.toContain("on PDP");
  });

  it("names them the way the page names them", () => {
    expect(form).toContain("Ask for a message");
    expect(form).toContain("Ask for a photo");
    expect(form).toContain("Message on this order");
  });

  it("stops building the label out of the shop's product word", () => {
    /**
     * It read "Allow {productLower} message", which prints "Allow bouquet
     * message" and "Allow dish message" for two of the shipped business types.
     * A message is not made of the thing it accompanies — the wrong mechanism
     * here, not a mechanism used wrongly.
     */
    expect(form).not.toContain("Allow {productLower} message");
  });
});
