import { describe, expect, it } from "vitest";

import { siteLayoutSchemas } from "./site-layout.validators";

describe("site-layout validators", () => {
  it("accepts a valid SEO store", () => {
    expect(
      siteLayoutSchemas.seo.safeParse({
        global: { siteName: "Sweet Crumbs Bakery", allowIndexing: true },
        routes: [
          {
            id: "seo-store-home",
            routeKey: "store-home",
            path: "/store",
            metaTitle: "Home",
            metaDescription: "Fresh cakes",
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects an SEO store without a global siteName", () => {
    expect(
      siteLayoutSchemas.seo.safeParse({ global: {}, routes: [] }).success,
    ).toBe(false);
  });

  it("accepts valid header settings", () => {
    expect(
      siteLayoutSchemas.header.safeParse({
        logoLetter: "M",
        showSearch: true,
        nav: [{ id: "nav-home", label: "Home", href: "/" }],
      }).success,
    ).toBe(true);
  });

  it("rejects a header nav item without an id", () => {
    expect(
      siteLayoutSchemas.header.safeParse({
        logoLetter: "M",
        nav: [{ label: "Home", href: "/" }],
      }).success,
    ).toBe(false);
  });

  it("accepts valid footer settings", () => {
    expect(
      siteLayoutSchemas.footer.safeParse({
        columns: [{ id: "col-1", title: "Shop", links: [] }],
        copyrightSuffix: "All rights reserved",
      }).success,
    ).toBe(true);
  });

  it("rejects a footer column without a title field", () => {
    expect(
      siteLayoutSchemas.footer.safeParse({
        columns: [{ id: "col-1" }],
        copyrightSuffix: "",
      }).success,
    ).toBe(false);
  });

  it("accepts valid appearance settings", () => {
    expect(
      siteLayoutSchemas.appearance.safeParse({
        primaryColor: "#6f4e37",
        accentColor: "#d4a373",
        surfaceColor: "#faf8f4",
        borderRadius: 12,
        preset: "classic",
      }).success,
    ).toBe(true);
  });

  it("rejects appearance settings without colors", () => {
    expect(
      siteLayoutSchemas.appearance.safeParse({ borderRadius: 12 }).success,
    ).toBe(false);
  });
});
