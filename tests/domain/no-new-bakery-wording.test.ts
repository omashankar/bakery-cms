import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The ratchet. 190 surfaces named the goods for the shop; this stops the 191st.
 *
 * The mechanism to avoid that — `resolveLabels`, `useBusinessLabels`,
 * `getServerLabels` — has worked for the whole life of the project, and 190
 * places still ignored it, because nothing ever said so. Every one was written
 * by somebody who could see that this shop was a bakery.
 *
 * This scans the text a HUMAN READS for trade words and fails on anything not
 * in the allowlist below. The allowlist is the interesting half: each entry is a
 * place where naming the trade is correct, with the reason. Adding to it should
 * feel like a decision, because it is one.
 *
 * What it deliberately does not scan: identifiers (`cake.price`, `CakeEntity`,
 * `/admin/cakes`), CSS tokens (the palette is literally named `bakery-700`),
 * search keywords, comments, and test files. Those are names for the code, or
 * words typed INTO the app rather than shown by it.
 */

const ROOT = process.cwd();

/** Where a shop's customers and staff actually read text. */
const SCANNED = [
  "apps/admin",
  "apps/website",
  "components/storefront",
  "components/shared",
  "features/orders/lib",
  "features/commerce/lib",
  "features/checkout",
  "features/customer-auth/server",
  "features/uploads/server",
  "features/payments/registry",
  "features/media/lib",
  "app",
  "lib/admin-breadcrumbs.ts",
];

/**
 * Naming the trade is RIGHT in these places. Each needs a reason, and "it was
 * already like that" is not one.
 */
const ALLOWED: { path: string; why: string }[] = [
  {
    path: "apps/admin/settings/components/modules-settings-page",
    why: "the optional modules ARE bakery product fields — flavour, egg preference, weight, shape, photo cake. Naming them is what tells a florist which to switch off.",
  },
  {
    path: "apps/admin/settings/components/settings-overview-page",
    why: "the same list, described from the Settings index.",
  },
  {
    path: "app/(admin)/admin/settings/modules/page",
    why: "that page's own metadata, describing the same modules.",
  },
  {
    path: "apps/website/pages/search-page",
    why: "the Photo Cake quick-search chip: gated on the photoCake module and filtered against the catalogue, so it shows only where it finds something.",
  },
  {
    path: "apps/admin/products/components/product-variant-manager",
    why: "the Type control is a bakery control (Egg preference / Photo cake), shown only while those modules are on.",
  },
  {
    path: "apps/admin/products/components/product-form-page",
    why: "the Photo cake option label, and a name placeholder that deliberately shows one edible and one not — 'Chocolate Truffle Cake, 65W Type-C Charger'.",
  },
  {
    path: "apps/website/pages/product-detail-page",
    why: "the photo-cake upload panel, behind the photoCake module.",
  },
  {
    path: "features/design-system",
    why: "the vendor's own component gallery, not a shop surface.",
  },
  {
    path: "app/design-system/page",
    why: "the same gallery's metadata.",
  },
  /**
   * The PRODUCT is called Bakery CMS. That is the vendor's name for the software,
   * not a shop's name for its goods — `AppBrand` says so, and the admin sidebar
   * already passes the shop's own name instead. Renaming the product is a real
   * decision and a separate one; it does not belong to this guard.
   */
  { path: "components/shared/app-brand", why: "the product's own name." },
  { path: "app/page", why: "the product's marketing metadata." },
  { path: "app/(admin)/admin/page", why: "the product's admin metadata." },
  {
    path: "app/platform",
    why: "the product's own marketing site and docs — pages about the CMS, read by the shop owners it is sold to.",
  },
  /**
   * A HISTORICAL RECORD, not wording. `LEGACY_SEEDED_CONTACT` lists the demo
   * address and phone this install once shipped, so a shop still holding them
   * un-edited does not start publishing them as its own. I "fixed" the address
   * here once and contact-details-are-the-shops-own caught it: rewriting the
   * list is exactly how the guarantee breaks.
   */
  {
    path: "apps/website/lib/shipped-placeholder",
    why: "the values this install used to ship, kept verbatim so they can still be rejected.",
  },
];

/**
 * Words that name the trade rather than the goods.
 *
 * `baked` and `baking` are in here because "freshly baked" was the single most
 * common claim in the sweep, and it is a claim about GOODS a shop may not sell —
 * not a label anything could substitute.
 */
const TRADE = /\b(cakes?|bakery|bakers?|bake[ds]?|baking|patisserie|pastries|confections?)\b/i;

/** Wedding cakes are a separately gated FEATURE that keeps its own name. */
const WEDDING = /wedding/i;

function walk(target: string, out: string[]) {
  let entries;
  try {
    entries = readdirSync(target, { withFileTypes: true });
  } catch {
    out.push(target); // a file, not a directory
    return;
  }
  for (const entry of entries) {
    const full = join(target, entry.name);
    if (entry.isDirectory()) {
      if (!/node_modules|[.]next|[.]git/.test(entry.name)) walk(full, out);
    } else if (/[.]tsx?$/.test(entry.name) && !/[.]test[.]/.test(entry.name)) {
      out.push(full);
    }
  }
}

/**
 * Text a human reads: string literals and bare JSX prose. Not code.
 *
 * Telling those apart one line at a time is the whole difficulty. A first cut
 * matched any indented line starting with a letter, and swept up `cakeId:
 * cake.id,` and `tally.set(cake.categoryId, ...)` — identifiers, reported as
 * though a customer read them. Prose is the text carrying none of the
 * punctuation code needs.
 */
export function readableStrings(line: string): string[] {
  if (/^\s*(\/\/|\*|\/\*)/.test(line)) return [];
  if (/^import |from ["']/.test(line)) return [];
  // The colour palette is named `bakery-700`; those are class names.
  if (/-bakery-|bakery-\d/.test(line)) return [];
  // A line that reaches into a product or a route is code ABOUT cakes, not
  // words a shop shows.
  if (/\bcakes?\s*[.[]|routes\.|\bCake[A-Z]/.test(line)) return [];
  // Search keywords are typed INTO the app, not read from it. The command
  // palette keeps "cake" matchable on purpose, so a rename cannot orphan a row.
  if (/\bkeywords:/.test(line)) return [];

  const found: string[] = [];
  for (const match of line.matchAll(/"([^"]{4,160})"|`([^`]{4,160})`/g)) {
    found.push(match[1] || match[2] || "");
  }
  // Bare JSX prose: indented, opens with a letter, and carries none of the
  // punctuation that would make it an expression.
  const bare = line.match(/^\s{4,}([A-Za-z][^<>{}"`=;:()[\]$]{6,120})$/);
  if (bare && !/\b(const|let|return|import|export|await)\b/.test(bare[1])) {
    found.push(bare[1]);
  }

  return found.filter((text) => {
    const trimmed = text.trim();
    if (!TRADE.test(trimmed)) return false;
    // Slugs, ids, routes, class strings — names for the code.
    if (/^[a-z0-9-/.]+$/.test(trimmed)) return false;
    if (/[${}]|=>/.test(trimmed)) return false;
    if (/^(flex|grid|rounded|border|hover:|sm:|md:|lg:|text-|bg-|size-)/.test(trimmed)) {
      return false;
    }
    if (WEDDING.test(trimmed)) return false;
    return true;
  });
}

/**
 * The lines of a file that are not inside a block comment.
 *
 * Per-line matching cannot see this: the continuation lines of a `/* … *\/` or a
 * JSX `{/* … *\/}` are prose starting with a letter, and this repo comments
 * heavily — a dozen explanations of the very bug being fixed were reported as
 * the bug.
 */
export function codeLines(source: string): { line: string; number: number }[] {
  const out: { line: string; number: number }[] = [];
  let inBlock = false;
  source.split(/\r?\n/).forEach((line, index) => {
    const opens = line.includes("/*");
    const closes = line.includes("*/");
    if (inBlock) {
      if (closes) inBlock = false;
      return;
    }
    if (opens && !closes) {
      inBlock = true;
      return;
    }
    out.push({ line, number: index + 1 });
  });
  return out;
}

describe("no new bakery wording on a shop surface", () => {
  const files: string[] = [];
  for (const target of SCANNED) walk(join(ROOT, target), files);

  const offenders: string[] = [];
  for (const file of files) {
    const rel = file.slice(ROOT.length + 1).split(sep).join("/");
    if (ALLOWED.some((entry) => rel.startsWith(entry.path))) continue;

    for (const { line, number } of codeLines(readFileSync(file, "utf8"))) {
      for (const text of readableStrings(line)) {
        offenders.push(`${rel}:${number}  ${text.trim().slice(0, 90)}`);
      }
    }
  }

  it("finds none", () => {
    expect(
      offenders,
      offenders.length
        ? `\nA shop that does not sell cakes would read these:\n\n${offenders.join("\n")}\n\n` +
            "Use the shop's own word — `useBusinessLabels()` in a client component, " +
            "`getServerLabels()` on the server, or a labels parameter for a pure module. " +
            "If naming the trade really is right here, add the file to ALLOWED with the reason.\n"
        : undefined,
    ).toEqual([]);
  });

  it("scans enough files to mean something", () => {
    // A walk that silently found nothing would pass the case above forever.
    expect(files.length).toBeGreaterThan(200);
  });

  it("would catch a new one", () => {
    // The matcher, exercised directly — so "finds none" cannot go green because
    // the matching quietly stopped working.
    expect(readableStrings('  const t = "Add a cake to your order";')).toEqual([
      "Add a cake to your order",
    ]);
    expect(readableStrings("        Freshly baked every morning")).toEqual([
      "Freshly baked every morning",
    ]);

    // And the kinds of false positive it must keep ignoring.
    expect(readableStrings('  <p className="text-bakery-700">Hi</p>')).toEqual([]);
    expect(readableStrings("  // a comment about cakes")).toEqual([]);
    expect(readableStrings('  const w = "Wedding Cakes";')).toEqual([]);
    expect(readableStrings("      cakeId: cake.id,")).toEqual([]);
    expect(readableStrings('    keywords: ["photo cake", "wedding"],')).toEqual([]);
  });

  it("does not read a block comment as prose", () => {
    const source = [
      "const a = 1;",
      "/*",
      "  A shop selling cakes AND chargers had no honest answer.",
      "*/",
      "const b = 2;",
    ].join("\n");

    expect(codeLines(source).map((entry) => entry.number)).toEqual([1, 5]);
  });
});
