import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { safeSetItem, safeRemoveItem } from "@/lib/safe-storage";

/**
 * A shop owner opened a product page and met this instead:
 *
 *     QuotaExceededError: Failed to execute 'setItem' on 'Storage':
 *     Setting the value of 'bakery-cms-testimonials' exceeded the quota.
 *
 * `localStorage.setItem` THROWS when the origin's ~5 MB is full, and this
 * project called it in 113 places without a single try/catch. So the first
 * write to meet the wall took down whatever page it happened on — and the one
 * that did was a CACHE REFRESH, hydrating the browser with what the server had
 * just sent. Nothing was lost by that write failing except a copy of data the
 * server still holds. What was lost was the page.
 *
 * The testimonials were 85 KB, so they were the victim rather than the cause.
 * The cause is base64 images: this shop's homepage-sections document is 11.8 MB
 * with 24 `data:image` URIs in it, and its media library another 2 MB. That is
 * a separate defect and it is not fixed here — but no amount of it should ever
 * have been able to break an unrelated page.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO is make room. Evicting another key to fit
 * this one would delete somebody's cart, or the address they had just typed, to
 * cache a list of testimonials.
 */

const ROOT = process.cwd();
const SKIP = new Set(["node_modules", ".next", ".git", "coverage", "tests", "scripts"]);

function sourceFiles(dir = ROOT, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP.has(entry.name)) continue;
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a write that cannot be made", () => {
  it("returns false instead of throwing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("exceeded the quota", "QuotaExceededError");
    });

    expect(() => safeSetItem("bakery-cms-testimonials", "[]")).not.toThrow();
    expect(safeSetItem("bakery-cms-testimonials", "[]")).toBe(false);
  });

  it("leaves every other value exactly where it was", () => {
    /**
     * The tempting fix is to clear something and retry. The something would be
     * a customer's cart.
     */
    localStorage.setItem("bakery-cms-cart", '[{"productSlug":"black-forest"}]');

    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key: string) => {
      if (key === "bakery-cms-cart") return;
      throw new DOMException("exceeded the quota", "QuotaExceededError");
    });

    safeSetItem("bakery-cms-testimonials", "[]");
    vi.restoreAllMocks();

    expect(localStorage.getItem("bakery-cms-cart")).toContain("black-forest");
  });

  it("survives a browser that refuses storage outright", () => {
    // Safari in private mode threw on ANY write; a browser set to block site
    // data throws on access. Neither is a reason for a page to stop rendering.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("The operation is insecure.");
    });

    expect(safeSetItem("bakery-cms-faq", "[]")).toBe(false);
  });

  it("says so when it worked", () => {
    expect(safeSetItem("bakery-cms-faq", '["x"]')).toBe(true);
    expect(localStorage.getItem("bakery-cms-faq")).toBe('["x"]');
  });

  it("guards a removal too", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("nope");
    });

    expect(() => safeRemoveItem("bakery-cms-faq")).not.toThrow();
    expect(safeRemoveItem("bakery-cms-faq")).toBe(false);
  });
});

describe("and nothing writes around it", () => {
  it("leaves no unguarded setItem in the app", () => {
    /**
     * The whole class, not the one file that happened to crash. 113 calls in 44
     * files went through this — repositories, the cart, the wishlist, the
     * theme, the admin layout — and a single one left behind is a page that can
     * still go down the same way.
     *
     * Tests and scripts are excluded: a fixture setting up storage directly is
     * not a page a customer is standing on.
     */
    const offenders = sourceFiles()
      .filter((file) => !file.endsWith(join("lib", "safe-storage.ts")))
      .filter((file) => {
        const source = readFileSync(file, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^[ \t]*\/\/.*$/gm, "");
        return source.includes("localStorage.setItem(");
      })
      .map((file) => file.slice(ROOT.length + 1));

    expect(offenders, "these can still throw QuotaExceededError").toEqual([]);
  });

  it("is the helper the app imports, not a copy per file", () => {
    const helper = readFileSync(join(ROOT, "lib", "safe-storage.ts"), "utf8");

    expect(helper).toContain("export function safeSetItem");

    /**
     * Scoped to `safeSetItem` itself, because `safeRemoveItem` below it removes
     * a key by design. What must not happen is the WRITE evicting anything to
     * make room — see the note at the top of this file.
     */
    const start = helper.indexOf("export function safeSetItem");
    const body = helper.slice(start, helper.indexOf("\n}", start));

    expect(body).not.toContain("removeItem");
    expect(body).not.toContain("clear()");
    expect(body.length).toBeGreaterThan(100);
  });
});
