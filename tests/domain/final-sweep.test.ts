import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { syncLegacyFlagsFromVariants } from "@/features/products/lib/variant-utils";
import { loadProducts } from "@/features/products/lib/products-repository";
import type { ProductVariantGroup } from "@/types/product";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

function bodyOf(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`not found: ${signature}`);

  let angle = 0;
  let paren = 0;
  let open = -1;
  for (let i = start + signature.length - 1; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "<") angle += 1;
    else if (ch === ">") angle = Math.max(0, angle - 1);
    else if (ch === "(") paren += 1;
    else if (ch === ")") paren = Math.max(0, paren - 1);
    else if (ch === "{" && angle === 0 && paren === 0) {
      open = i;
      break;
    }
  }
  if (open < 0) throw new Error(`no body for: ${signature}`);

  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return stripComments(source.slice(start, i + 1));
    }
  }
  throw new Error(`unbalanced: ${signature}`);
}

/**
 * Emptying a field was impossible.
 *
 * The client sent `reportReason: undefined` when approving a reported review,
 * `JSON.stringify` drops undefined keys, so the PATCH body never carried the
 * field and `$set` never touched it. The flag cleared on the moderator's screen
 * and stayed in the database, where the next hydration brought it back.
 */
describe("a cleared field actually clears", () => {
  it("the client sends an empty string, not undefined", () => {
    const fn = bodyOf(read("features/reviews/lib/reviews-repository.ts"), "export function setReviewStatus(");
    expect(fn).toMatch(/reportReason: status === "reported" \? review\.reportReason : ""/);
    expect(fn).not.toContain(": undefined");
  });

  it("the server turns an empty clearable into an $unset", () => {
    const fn = bodyOf(read("features/reviews/server/review.repository.ts"), "export async function patch(");
    expect(fn).toContain("CLEARABLE_FIELDS");
    expect(fn).toContain("update.$unset = unset");
    // An undefined value must still mean "leave it alone".
    expect(fn).toContain("else if (value !== undefined) set[key] = value");
  });

  it("names the fields an admin can legitimately empty", () => {
    const source = read("features/reviews/server/review.repository.ts");
    const list = source.slice(source.indexOf("const CLEARABLE_FIELDS"), source.indexOf("export async function patch("));
    for (const field of ["reportReason", "adminReply", "repliedAt", "title"]) {
      expect(list).toContain(field);
    }
    // `body` and `rating` are not clearable — an empty one is invalid input.
    expect(list).not.toContain('"body"');
    expect(list).not.toContain('"rating"');
  });
});

/** Optimistic writes that were never rolled back. */
describe("bulk moderation writes only what the server took", () => {
  const fn = bodyOf(read("features/reviews/lib/reviews-repository.ts"), "async function setStatusBulk(");

  it("asks first, then writes", () => {
    expect(fn.indexOf("updateReviewRequest")).toBeLessThan(fn.indexOf("writeReviews("));
  });

  it("writes only the accepted ids", () => {
    expect(fn).toContain("const accepted = new Set(ids.filter((_, index) => results[index]))");
    expect(fn).toContain("accepted.has(review.id)");
  });

  it("counts from the answers, not from the accepted set", () => {
    // A duplicate id in the selection would otherwise make the report disagree
    // with the number of writes actually made.
    expect(fn).toContain("const failed = results.filter((ok) => !ok).length");
    expect(fn).toContain("updated: ids.length - failed");
  });
});

describe("adding a review does not invite a duplicate", () => {
  it("reports the review as stored when only the moderation step failed", () => {
    const fn = bodyOf(read("features/reviews/lib/reviews-repository.ts"), "export async function createReview(");
    expect(fn).toContain('return { review, persisted: true, partial: "moderation" }');
  });

  it("the screen says it is pending rather than that nothing was saved", () => {
    const fn = bodyOf(read("apps/admin/reviews/pages/reviews-admin-page.tsx"), "async function handleSaveReview(");
    expect(fn).toContain('partial === "moderation"');
    expect(fn).toContain("still pending");
  });

  it("gives each new review a locally unique id", () => {
    // `review-${Date.now()}` gave two reviews added in the same millisecond the
    // same id, so the second overwrote the first and a bulk action over both
    // addressed one row. Caught by an existing test, not by inspection.
    const source = stripComments(read("features/reviews/lib/reviews-repository.ts"));
    expect(source).not.toMatch(/id: `review-\$\{Date\.now\(\)\}`/);
    expect(bodyOf(read("features/reviews/lib/reviews-repository.ts"), "function newLocalId(")).toContain(
      "crypto.randomUUID",
    );
  });
});

/**
 * A top-level `export const` block, up to the next export.
 *
 * `bodyOf` cannot read these: the declaration is wrapped in a call
 * (`withErrorHandler(async (req) => {`), so the body's `{` never appears at
 * paren depth zero and the scanner walks off the end.
 */
function exportedConst(source: string, name: string): string {
  const start = source.indexOf(`export const ${name}`);
  if (start < 0) throw new Error(`not found: export const ${name}`);
  const rest = source.slice(start + 1);
  const end = rest.indexOf("\nexport ");
  return stripComments(rest.slice(0, end > 0 ? end : undefined));
}

describe("the public review endpoint is rate limited", () => {
  const fn = exportedConst(read("features/reviews/server/review.controller.ts"), "submitReviewController");

  it("limits by ip before doing any work", () => {
    // Unauthenticated, and every submission lands in the moderation queue — one
    // script can bury a shop's real reviews. Login and password reset, the only
    // other public write paths, already use this helper.
    expect(fn).toContain("rateLimit(`review:${ctx.ip}`");
    expect(fn.indexOf("rateLimit(")).toBeLessThan(fn.indexOf("service.submitReview"));
  });
});

/**
 * Reviews are keyed by slug and stock history by product id. Neither was touched
 * on delete, so both became orphans that still counted — and the slug is free
 * again, so a new cake with the same slug inherited the dead one's reviews.
 */
describe("deleting a product takes its traces with it", () => {
  it("removes the reviews and the stock history", () => {
    const fn = bodyOf(read("features/products/server/product-cascade.server.ts"), "export async function purgeProductTraces(");
    expect(fn).toContain("ReviewModel.deleteMany({ productSlug: slug })");
    expect(fn).toContain("StockHistoryModel.deleteMany({ cakeId: id })");
  });

  it("leaves orders alone", () => {
    // A past order is a record of something that happened and has to survive the
    // product being withdrawn.
    const source = read("features/products/server/product-cascade.server.ts");
    expect(source).not.toContain("OrderModel");
  });

  it("reads the product BEFORE deleting it, or there is no slug to clean up", () => {
    const fn = bodyOf(read("features/products/data/products-service.ts"), "export async function deleteProduct(");
    expect(fn.indexOf("getProductById(id)")).toBeLessThan(fn.indexOf("deleteOne(id)"));
    expect(fn).toContain("purgeProductTraces(existing.slug, existing.id)");
  });

  it("does not fail the delete when the cleanup fails", () => {
    const fn = bodyOf(read("features/products/data/products-service.ts"), "export async function deleteProduct(");
    expect(fn).toContain("catch (error)");
    expect(fn).toContain("return true");
  });
});

describe("the preview screen shows what was just saved", () => {
  const fn = bodyOf(read("apps/admin/products/components/product-preview-page.tsx"), "useEffect(");

  it("always asks the server, using the cache only to fill the gap", () => {
    // It returned as soon as localStorage had the product — and product saves do
    // not write that cache, so the screen whose job is "show me what I changed"
    // showed the version from before the edit.
    expect(fn).toContain("if (cached) setCake(cached)");
    expect(fn).toContain("fetchProduct(cakeId)");
    expect(fn).not.toMatch(/if \(cached\) \{[\s\S]*?return;/);
  });

  it("only redirects away when there was nothing to show at all", () => {
    expect(fn).toContain("if (!cancelled && !cached) router.replace");
  });
});

describe("the Preview button", () => {
  const fn = bodyOf(read("apps/admin/products/components/product-form-page.tsx"), "function openPreview(");

  it("sends a draft to the admin preview instead of a 404", () => {
    // The storefront route serves published products only.
    expect(fn).toMatch(/form\.status !== "published"/);
    expect(fn).toContain("routes.admin.cakes.preview(cakeId)");
  });

  it("refuses to preview something that does not exist yet", () => {
    expect(fn).toMatch(/mode === "add" \|\| !cakeId/);
  });
});

describe("a name with no Latin characters", () => {
  it("is refused with an explanation rather than poisoning the section", () => {
    // `slugify` strips everything outside [\w\s-], so मिठाई yields "". The server
    // rejects it, and because each catalog section is a replace-all that refusal
    // blocks every later save of the section until the page is reloaded.
    const source = read("apps/admin/catalog/components/catalog-form-dialog.tsx");
    expect(source).toContain("if (!finalSlug)");
    expect(source).toContain("Add a URL slug");
  });
});

describe("the eggless tick survives a save", () => {
  const noGroups: ProductVariantGroup[] = [];
  const eggGroup: ProductVariantGroup[] = [
    {
      id: "g1",
      name: "Egg",
      type: "egg",
      required: true,
      options: [
        { id: "o1", label: "With egg", priceDelta: 0, isDefault: true, semantic: "with-egg" },
        { id: "o2", label: "Eggless", priceDelta: 50, isDefault: false, semantic: "eggless" },
      ],
    } as unknown as ProductVariantGroup,
  ];

  it("keeps the admin's tick when there is no egg variant group", () => {
    // Most products have none, and the flag was derived unconditionally — so the
    // tick came back off, and the eggless filter and badge never applied.
    const flags = syncLegacyFlagsFromVariants(noGroups, {}, { isEggless: true });
    expect(flags.isEggless).toBe(true);
  });

  it("still derives from the variants when there IS a group", () => {
    const flags = syncLegacyFlagsFromVariants(eggGroup, {}, { isEggless: true });
    expect(flags.isEggless).toBe(false);
  });

  it("defaults to false when nothing says otherwise", () => {
    expect(syncLegacyFlagsFromVariants(noGroups, {}).isEggless).toBe(false);
  });
});

describe("an unreadable product cache", () => {
  beforeEach(() => localStorage.clear());

  it("does not throw, and does not put demo cakes in front of the admin", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    // Two bugs met here. `getItem` itself throws in a browser that denies
    // storage — private mode, blocked cookies — and that read sat OUTSIDE the
    // try, so every admin screen calling this crashed. And the catch answered a
    // storage failure by replacing the shop's cached catalogue with 34 demo
    // cakes, which those screens then showed to an admin whose real products
    // were fine on the server.
    expect(() => loadProducts()).not.toThrow();
    expect(loadProducts()).toEqual([]);
    vi.restoreAllMocks();
  });
});
