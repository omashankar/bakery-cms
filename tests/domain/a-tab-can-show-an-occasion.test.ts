/**
 * A TAB CAN SHOW AN OCCASION — AND THE EDITOR SAYS WHAT A TAB SHOWS.
 *
 * The tabbed row's tabs were labelled Birthday Cakes, Wedding and Anniversary,
 * and the rail behind each one already resolved a slug across all three of the
 * shop's lists (collection, then category, then occasion). The "Shows" picker
 * offered CATEGORIES alone. So:
 *
 *  - Wedding and Anniversary could not be chosen at all, and
 *  - a tab saved as the Birthday occasion matched no option, so the browser
 *    showed the FIRST one — the editor read "Chocolate Cakes" while the shop
 *    drew Birthday, and the admin "fixed" it to a category that was wrong.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getRegistryEntry, resolveRegistryEntry } from "@/constants/section-registry";
import { SectionEditorPanel } from "@/apps/admin/builders/shared/section-editor-panel";

const LABELS = { productWord: "Cake", productWordPlural: "Cakes" };
const SOURCES = {
  categories: [
    { id: "c1", name: "Chocolate Cakes", slug: "chocolate-cakes" },
    { id: "c2", name: "Photo Cakes", slug: "photo-cakes" },
    // A category a collection also claims: the collection wins that address.
    { id: "c3", name: "Bestseller Cakes", slug: "bestsellers" },
  ],
  occasions: [
    { name: "Birthday", slug: "birthday" },
    { name: "Wedding", slug: "wedding" },
    // An occasion a category also claims: the category wins.
    { name: "Chocolate Day", slug: "chocolate-cakes" },
  ],
  collections: [{ name: "Bestsellers", slug: "bestsellers" }],
  groupNames: { categories: "Types", occasions: "Moments", collections: "Edits" },
};

function tabPicker(sources?: Parameters<typeof resolveRegistryEntry>[2]) {
  const resolved = resolveRegistryEntry(getRegistryEntry("tabbed-rail")!, LABELS, sources);
  return resolved.fields
    .find((field) => field.key === "tabs")
    ?.itemFields?.find((field) => field.key === "categorySlug");
}

describe("the tab picker offers every list a tab can draw from", () => {
  it("offers occasions and collections beside categories, under the shop's words", () => {
    expect(tabPicker(SOURCES)?.options).toEqual([
      { label: "Chocolate Cakes", value: "chocolate-cakes", group: "Types" },
      { label: "Photo Cakes", value: "photo-cakes", group: "Types" },
      { label: "Birthday", value: "birthday", group: "Moments" },
      { label: "Wedding", value: "wedding", group: "Moments" },
      { label: "Bestsellers", value: "bestsellers", group: "Edits" },
    ]);
  });

  it("offers a shared slug once, under the list the rail resolves it to", () => {
    /*
      Offering the loser too would be a choice that draws the other list's
      products. Collection beats category beats occasion — buildCategoryRail's
      order, and the route's.
    */
    const values = (tabPicker(SOURCES)?.options ?? []).map((option) => option.value);
    expect(values.filter((value) => value === "bestsellers")).toHaveLength(1);
    expect(values.filter((value) => value === "chocolate-cakes")).toHaveLength(1);
    const labels = (tabPicker(SOURCES)?.options ?? []).map((option) => option.label);
    expect(labels).not.toContain("Bestseller Cakes");
    expect(labels).not.toContain("Chocolate Day");
  });

  it("the single-category row offers the same three lists", () => {
    const resolved = resolveRegistryEntry(getRegistryEntry("category-rail")!, LABELS, SOURCES);
    const values = resolved.fields
      .find((field) => field.key === "categorySlug")
      ?.options?.map((option) => option.value);
    expect(values).toContain("birthday");
    expect(values).toContain("bestsellers");
  });

  it("but the bands that read CATEGORY data stay on categories", () => {
    /*
      Price cards show a category's starting price and the categories band its
      picture — neither exists for an occasion, so offering one would be a card
      with nothing to draw.
    */
    for (const type of ["category-price-cards", "our-menu"] as const) {
      const entry = getRegistryEntry(type);
      expect(entry, `${type} is gone from the registry`).toBeDefined();
      const resolved = resolveRegistryEntry(entry!, LABELS, SOURCES);
      const pickers = resolved.fields
        .flatMap((field) => field.itemFields ?? [])
        .filter((field) => field.key === "categorySlug");
      // A loop over nothing passes; make sure there is something to check.
      expect(pickers, `${type} has no category picker`).toHaveLength(1);
      expect(pickers[0].options?.map((option) => option.value), type).toEqual([
        "chocolate-cakes",
        "photo-cakes",
        "bestsellers",
      ]);
    }
  });
});

describe("the editor never shows a choice nobody made", () => {
  function editorFor(tabs: { label: string; categorySlug: string }[]) {
    const entry = resolveRegistryEntry(getRegistryEntry("tabbed-rail")!, LABELS, SOURCES);
    return renderToStaticMarkup(
      createElement(SectionEditorPanel, {
        section: {
          instanceId: "t",
          type: "tabbed-rail",
          background: "white",
          content: { title: "Bestsellers", tabs: JSON.stringify(tabs) },
        },
        onChange: () => {},
        resolveEntry: () => entry,
        settingsNote: "",
      }),
    );
  }

  it("selects the occasion a tab was saved as", () => {
    const html = editorFor([{ label: "Birthday Cakes", categorySlug: "birthday" }]);
    expect(html).toMatch(/<option value="birthday" selected="">Birthday<\/option>/);
    expect(html).not.toMatch(/<option value="chocolate-cakes" selected=""/);
  });

  it("draws the lists under their headings", () => {
    const html = editorFor([{ label: "Birthday Cakes", categorySlug: "birthday" }]);
    expect(html).toContain('<optgroup label="Moments">');
    expect(html).toContain('<optgroup label="Types">');
  });

  it("names a saved slug that is in no list, instead of showing the first option", () => {
    const html = editorFor([{ label: "Eggless", categorySlug: "eggless" }]);
    expect(html).toMatch(/<option value="eggless" disabled="" selected="">/);
    expect(html).not.toMatch(/<option value="chocolate-cakes" selected=""/);
  });

  it("asks for a choice on a new, blank tab", () => {
    const html = editorFor([{ label: "", categorySlug: "" }]);
    expect(html).toMatch(/<option value="" selected="">Choose…<\/option>/);
  });
});
