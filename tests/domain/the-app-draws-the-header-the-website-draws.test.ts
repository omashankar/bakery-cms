import { describe, expect, it } from "vitest";

import { storefrontMenuFrom } from "@/features/cms-sections/lib/storefront-menu";
import { defaultHeaderSettings } from "@/features/site-layout/lib/header-utils";
import type { HeaderNavItem, MegaMenuGroup } from "@/types/site-layout";

/**
 * THE APP'S ROW OF TABS IS THE WEBSITE'S HEADER BAND.
 *
 * `/api/storefront/home` sends `menu`: the top-level rows the website's
 * header draws, for the app to draw as icon tabs under its search bar. The
 * website decides which rows in `getStorefrontChrome` (menus resolved, then
 * visible rows in order) and in the navbar's `bandRows` (no Home row, no row
 * `navRowOpensNothing` drops); `storefrontMenuFrom` restates both.
 */

function row(id: string, href: string, extra: Partial<HeaderNavItem> = {}): HeaderNavItem {
  return { id, label: `Label ${id}`, href, isVisible: true, sortOrder: 1, ...extra };
}

const catalog = {
  categories: [
    { id: "c-choc", slug: "chocolate-cakes", name: "Chocolate", image: "/uploads/choc.webp", isActive: true },
    { id: "c-plain", slug: "plain", name: "Plain", image: "", isActive: true },
    { id: "c-off", slug: "switched-off", name: "Off", image: "/uploads/off.webp", isActive: false },
    // Its address is a collection's: the route opens the collection.
    { id: "c-best", slug: "bestsellers", name: "Best (category)", image: "/uploads/cat-best.webp", isActive: true },
  ],
  occasions: [{ id: "o-bday", slug: "birthday", name: "Birthday", image: "/uploads/bday.webp", isActive: true }],
  collections: [
    { id: "l-best", slug: "bestsellers", name: "Bestsellers", image: "/uploads/best.webp", isActive: true, productIds: ["p1"] },
    { id: "l-empty", slug: "empty", name: "Empty", image: "/uploads/empty.webp", isActive: true, productIds: [] },
  ],
  departments: [{ id: "d-gifts", slug: "gifts", name: "Gifts", image: "/uploads/gifts.webp", isActive: true, categoryIds: ["c-choc"] }],
};

const group = (links: MegaMenuGroup["links"], extra: Partial<MegaMenuGroup> = {}): MegaMenuGroup =>
  ({ id: "g", heading: "By flavour", sortOrder: 1, isVisible: true, links, ...extra }) as MegaMenuGroup;

describe("which rows", () => {
  it("is the visible rows in the shop's order, without Home", () => {
    const menu = storefrontMenuFrom(
      {
        nav: [
          row("pastries", "/store/collections/plain", { sortOrder: 4 }),
          row("home", "/store", { sortOrder: 1 }),
          row("all", "/store/collections", { sortOrder: 2 }),
          row("hidden", "/store/collections/chocolate-cakes", { sortOrder: 3, isVisible: false }),
          row("bday", "/store/occasions/birthday", { sortOrder: 5 }),
        ],
      },
      catalog,
    );
    expect(menu.map((item) => item.label)).toEqual(["Label all", "Label pastries", "Label bday"]);
  });

  it("drops a menu-only row whose menu has nothing left to open, as both menus do", () => {
    const gone = group([{ id: "x", label: "Gone", href: "/store/collections/x", ref: { axis: "category", id: "c-off" } }]);
    const kept = group([{ id: "y", label: "Choc", href: "/store/collections/chocolate-cakes", ref: { axis: "category", id: "c-choc" } }]);
    const menu = storefrontMenuFrom(
      {
        nav: [
          row("emptied", "/store/collections/plain", { sortOrder: 1, menuOnly: true, menu: [gone] }),
          row("switched-off-group", "/store/collections/plain", { sortOrder: 2, menuOnly: true, menu: [{ ...kept, isVisible: false }] }),
          row("cakes", "/store/collections/chocolate-cakes", { sortOrder: 3, menuOnly: true, menu: [kept] }),
          // The taxonomy row opens the shop's axes even with no groups of its own.
          row("taxonomy", "/store/collections", { sortOrder: 4, menuOnly: true }),
        ],
      },
      catalog,
    );
    expect(menu.map((item) => item.label)).toEqual(["Label cakes", "Label taxonomy"]);
    // A menu-only row keeps its own address: the page the shop kept behind it.
    expect(menu[0].href).toBe("/store/collections/chocolate-cakes");
  });

  it("is the shipped rows for a header stored before `nav` existed, and none when unread", () => {
    const shipped = defaultHeaderSettings.nav.filter((item) => item.href !== "/store").map((item) => item.label);
    expect(storefrontMenuFrom({ showSearch: true }, catalog).map((item) => item.label)).toEqual(shipped);
    expect(storefrontMenuFrom(null, catalog)).toEqual([]);
  });

  it("sends only the three fields, nothing of the stored row", () => {
    const [item] = storefrontMenuFrom(
      { nav: [row("x", "/store/collections/plain", { highlight: true, badge: "New", icon: "Gift" })] },
      catalog,
    );
    expect(item).toEqual({ label: "Label x", href: "/store/collections/plain", imageUrl: null });
  });
});

describe("the picture", () => {
  const image = (href: string) => storefrontMenuFrom({ nav: [row("r", href)] }, catalog)[0].imageUrl;

  it("is the linked category's", () => {
    expect(image("/store/collections/chocolate-cakes")).toBe("/uploads/choc.webp");
    expect(image("/store/collections/chocolate-cakes?sort=new")).toBe("/uploads/choc.webp");
  });

  it("is the collection's where a collection holds the address — the category there is not offered", () => {
    expect(image("/store/collections/bestsellers")).toBe("/uploads/best.webp");
  });

  it("is the occasion's and the department's at their own addresses", () => {
    expect(image("/store/occasions/birthday")).toBe("/uploads/bday.webp");
    expect(image("/store/departments/gifts")).toBe("/uploads/gifts.webp");
    // A category's slug at an occasion address is not that category.
    expect(image("/store/occasions/chocolate-cakes")).toBeNull();
  });

  it("is null for a group not offered, one with no picture, the whole catalogue, a page or another site", () => {
    expect(image("/store/collections/switched-off")).toBeNull();
    expect(image("/store/collections/empty")).toBeNull();
    expect(image("/store/collections/plain")).toBeNull();
    expect(image("/store/collections")).toBeNull();
    expect(image("/store/contact")).toBeNull();
    expect(image("https://example.com/store/collections/chocolate-cakes")).toBeNull();
  });
});
