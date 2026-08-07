import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { adjustStockSchema } from "@/features/inventory/server/inventory.validators";

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
 * Stock is the one number a shop cannot afford to get wrong, and two writers
 * touch it: order placement (`$inc` inside a transaction) and admin
 * adjustments.
 *
 * The adjustment used to read the quantity, do the arithmetic in JS and write
 * the ABSOLUTE result — so an order placed in that window was erased. The cakes
 * left the shop and the number went back to what the admin had been looking at.
 * Verified live: 6 in stock, 5 sold, admin adds 10 — the row now reads 11, and
 * read the buggy 16 before.
 */
describe("stock arithmetic happens in the database", () => {
  const repository = read("features/products/server/product.repository.ts");
  const fn = bodyOf(repository, "export async function applyStockDelta(");

  it("computes the new quantity from the stored row, not from a prior read", () => {
    expect(fn).toContain("$ifNull");
    expect(fn).toMatch(/\$add:\s*\[current, quantity\]/);
    expect(fn).toMatch(/\$max:\s*\[0,\s*\{\s*\$subtract/);
  });

  it("clamps a removal at zero inside the same operation", () => {
    // `Math.max(0, ...)` in JS would be a second round trip, and the row could
    // move in between. The clamp is part of the write.
    const removeBranch = fn.slice(fn.indexOf('type === "remove"'));
    expect(removeBranch).toContain("$max");
  });

  it("returns the pre-image from the same operation", () => {
    // So the history row records what was really replaced, rather than a value
    // read moments earlier that something else has since changed.
    expect(fn).toContain('returnDocument: "before"');
  });

  it("goes through the raw collection, because Mongoose rejects a pipeline", () => {
    // A pipeline update is an ARRAY of stages; Mongoose casts an update as field
    // assignments and threw, which surfaced as a 500 on every adjustment. Caught
    // by running it against the real server, not by the type checker.
    expect(fn).toContain("ProductModel.collection.findOneAndUpdate");
  });

  it("the service no longer does the arithmetic itself", () => {
    const service = bodyOf(read("features/inventory/server/inventory.service.ts"), "export async function adjustStock(");
    expect(service).toContain("productRepo.applyStockDelta");
    // The shapes that made it a read-modify-write.
    expect(service).not.toMatch(/after = before \+/);
    expect(service).not.toMatch(/patchFields\([^)]*stockQuantity/);
  });

  it("labels the row with a status derived from the quantity it really holds", () => {
    const setStatus = bodyOf(read("features/products/server/product.repository.ts"), "export async function setStockStatusFor(");
    // Filtering on the quantity means a sale landing in between is not labelled
    // by a status computed for a number that is no longer there.
    expect(setStatus).toMatch(/_id: id, stockQuantity: quantity/);
  });

  it("hands back what the row holds, not what was computed", () => {
    const service = bodyOf(read("features/inventory/server/inventory.service.ts"), "export async function adjustStock(");
    expect(service).toContain("updated?.stockQuantity ?? after");
    expect(service).toContain("updated?.stockStatus ?? stockStatus");
  });
});

/** Whole cakes only. */
describe("adjustment quantities are integers", () => {
  const base = { cakeId: "p1", type: "add" as const };

  it("accepts a whole number", () => {
    expect(adjustStockSchema.safeParse({ ...base, quantity: 12 }).success).toBe(true);
  });

  it("refuses a fraction", () => {
    // 4.5 was stored, and no badge, filter or oversell check treats it as a
    // sellable count — `{ $gte: quantity }` then refused a sale the shop could
    // have fulfilled.
    expect(adjustStockSchema.safeParse({ ...base, quantity: 4.5 }).success).toBe(false);
  });

  it("still refuses a negative", () => {
    expect(adjustStockSchema.safeParse({ ...base, quantity: -1 }).success).toBe(false);
  });

  it("refuses an absurd quantity", () => {
    expect(adjustStockSchema.safeParse({ ...base, quantity: 5_000_000 }).success).toBe(false);
  });
});

/**
 * A refused write must leave nothing behind — least of all an audit row for an
 * adjustment that never happened.
 */
describe("the admin screen writes only what the server accepted", () => {
  const fn = bodyOf(read("apps/admin/commerce/lib/inventory-repository.ts"), "export async function adjustStock(");

  it("asks the server before touching the cache", () => {
    const request = fn.indexOf("adjustStockRequest(");
    const write = fn.indexOf("updateProduct(cakeId");
    const history = fn.indexOf("appendStockHistory(");

    expect(request).toBeGreaterThan(-1);
    expect(request).toBeLessThan(write);
    expect(request).toBeLessThan(history);
  });

  it("returns early on a refusal, leaving no local number and no history row", () => {
    expect(fn).toContain("if (!applied) return { item: null, persisted: false }");
  });

  it("stores the server's quantity rather than its own", () => {
    // They diverge the moment an order or a second admin touches the row, and
    // only one of them is what the shop sells against.
    expect(fn).toContain("const quantityAfter = applied.stockQuantity");
    expect(fn).not.toMatch(/quantityAfter = quantityBefore \+/);
  });

  it("the request returns the server's figure, not a boolean", () => {
    const api = bodyOf(read("apps/admin/commerce/lib/inventory-api.ts"), "export function adjustStockRequest(");
    expect(api).toContain("post<AdjustStockResult>");
    expect(api).not.toContain("wrote(");
  });
});

/** The numbers that decide whether anyone bakes more. */
describe("the stat cards", () => {
  it("count only what the shop can still sell", () => {
    const fn = bodyOf(read("features/inventory/server/inventory.service.ts"), "export async function getOverview(");
    // Archived cakes were counted, so "3 need restocking" included ones
    // withdrawn from sale months ago and the alert badge never cleared.
    expect(fn).toMatch(/filter\(\(p\) => p\.status !== "archived"\)/);
    expect(fn).toContain('p.status === "published"');
  });

  it("come from the server, with the local computation only as a fallback", () => {
    const page = read("apps/admin/commerce/pages/inventory-admin-page.tsx");
    expect(page).toContain("fetchInventoryOverview()");
    expect(page).toContain("serverOverview ?? (mounted ? getInventoryOverview() : EMPTY_OVERVIEW)");
  });

  it("are re-read after every adjustment, not just on mount", () => {
    const page = read("apps/admin/commerce/pages/inventory-admin-page.tsx");
    const fn = bodyOf(page, "function onInventoryUpdated(");
    expect(fn).toContain("refreshOverview()");
  });

  it("the screen re-reads when the product cache hydrates", () => {
    // Otherwise the item list shows whatever localStorage held at mount for the
    // whole visit — on a fresh browser, the demo seed's stock levels.
    const page = read("apps/admin/commerce/pages/inventory-admin-page.tsx");
    expect(page).toMatch(/addEventListener\(PRODUCTS_UPDATED_EVENT/);
    expect(page).toMatch(/removeEventListener\(PRODUCTS_UPDATED_EVENT/);
  });
});

/** The history table only ever grows. */
describe("stock history is indexed for the way it is read", () => {
  const model = read("lib/server/db/models/stock-history.model.ts");

  it("has an index for the whole-shop listing", () => {
    expect(model).toMatch(/index\(\{\s*createdAt:\s*-1\s*\}\)/);
  });

  it("has a compound index for one cake's history", () => {
    expect(model).toMatch(/index\(\{\s*cakeId:\s*1,\s*createdAt:\s*-1\s*\}\)/);
  });
});
