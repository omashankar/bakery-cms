// @vitest-environment node
/**
 * The proxy answers an unknown /store URL with a real 404 — so its table of
 * store pages must never miss a real one.
 *
 * Every missing /store URL used to be served as 200 + noindex: `store/loading.tsx`
 * starts the stream before a page can call `notFound()`. The proxy now decides
 * first, from `lib/store-routes.ts`. The danger of a table is drift: a page added
 * later and not listed would be rewritten to "not found" for every customer. So
 * the pages are read from the FOLDERS here, not from the table.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "@/proxy";
import { isKnownStorePath, STORE_NOT_FOUND_PATH } from "@/lib/store-routes";

const STORE_DIR = join(process.cwd(), "app", "(storefront)", "store");

/** Every page.tsx under app/(storefront)/store, as a sample URL. */
function storePageUrls(): string[] {
  const urls: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name === "page.tsx") {
        const segments = relative(STORE_DIR, dir)
          .split(sep)
          .filter((s) => s && !(s.startsWith("(") && s.endsWith(")")));
        if (segments.some((s) => s.startsWith("[..."))) continue; // the catch-all itself
        urls.push(["/store", ...segments.map((s) => (s.startsWith("[") ? "sample-slug" : s))].join("/"));
      }
    }
  };
  walk(STORE_DIR);
  return urls;
}

const rewriteOf = (path: string) =>
  proxy(new NextRequest(`http://localhost${path}`)).headers.get("x-middleware-rewrite");

describe("the store pages the proxy knows", () => {
  const pages = storePageUrls();

  it("found the store's pages at all", () => {
    // An empty walk would make the next test pass for nothing.
    expect(pages.length).toBeGreaterThanOrEqual(15);
    expect(pages).toContain("/store/p/sample-slug");
  });

  it.each(storePageUrls())("lets %s through to its page", (url) => {
    expect(isKnownStorePath(url), `${url} is a real page the proxy would call missing`).toBe(true);
    expect(rewriteOf(url)).toBeNull();
  });

  it.each([
    "/store/zz-no-such-page",
    "/store/p",
    "/store/p/a-cake/extra",
    "/store/cart/extra",
    "/store/order/BK-1/invoice/extra",
    "/store/collections/a/b",
    "/store/old-site/product/123",
  ])("rewrites %s to the real-404 route", (url) => {
    expect(isKnownStorePath(url)).toBe(false);
    expect(rewriteOf(url)).toContain(STORE_NOT_FOUND_PATH);
  });

  it("leaves everything outside /store alone", () => {
    for (const url of ["/", "/platform", "/store", "/login", "/store-not-found"]) {
      expect(rewriteOf(url), url).toBeNull();
    }
  });

  it("rewrites to a route OUTSIDE the store's loading boundary", () => {
    // Under store/, the stream would start first and the status would be 200 again.
    const route = join(process.cwd(), "app", "(storefront)", STORE_NOT_FOUND_PATH.slice(1));
    expect(existsSync(join(route, "page.tsx"))).toBe(true);
    expect(existsSync(join(route, "not-found.tsx")), "the 404 would render without the shop").toBe(true);
    expect(existsSync(join(route, "loading.tsx"))).toBe(false);
    expect(existsSync(join(process.cwd(), "app", "(storefront)", "loading.tsx"))).toBe(false);
  });
});
