import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { isDuplicateSlugError } from "@/features/products/server/product.repository";

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
 * A product write must touch one document.
 *
 * Every mutation used to go through `mutateProducts`: read the whole collection,
 * change one entry, write every document back. An in-process queue serialised
 * those against each other, but two writers are not in it — order placement,
 * which does `$inc` on `stockQuantity` inside a transaction, and inventory
 * adjustments, which use `patchFields`. So a cake sold during an admin's save
 * had its stock put back by that save: stock unchanged, cakes gone, shop
 * overselling. Verified live before and after.
 */
describe("product writes address one document", () => {
  const service = read("features/products/data/products-service.ts");

  it("create, update and delete do not rewrite the collection", () => {
    for (const fn of [
      "export async function createProduct(",
      "export async function updateProduct(",
      "export async function deleteProduct(",
      "export async function setProductStatus(",
    ]) {
      const body = bodyOf(service, fn);
      expect(body, `${fn} must not read-modify-write the collection`).not.toContain(
        "mutateProducts",
      );
      expect(body, `${fn} must not replace every document`).not.toContain("replaceAll");
    }
  });

  it("each one uses the targeted repository call", () => {
    expect(bodyOf(service, "export async function createProduct(")).toContain(
      "productRepo.insertOne",
    );
    expect(bodyOf(service, "export async function updateProduct(")).toContain(
      "productRepo.replaceOne",
    );
    expect(bodyOf(service, "export async function deleteProduct(")).toContain(
      "productRepo.deleteOne",
    );
    expect(bodyOf(service, "export async function setProductStatus(")).toContain(
      "productRepo.setStatusMany",
    );
  });

  it("bulk status is one statement over one field", () => {
    const fn = bodyOf(read("features/products/server/product.repository.ts"), "export async function setStatusMany(");
    expect(fn).toContain("ProductModel.updateMany");
    expect(fn).not.toContain("replaceOne");

    // Assert the WHOLE $set, not that it starts with `status`. Any other field
    // in there carries this caller's idea of its value over whatever an order or
    // a stock adjustment has since written — which is the bug being fixed, in a
    // smaller shape.
    const set = fn.match(/\$set:\s*\{([^}]*)\}/)?.[1];
    expect(set, "no $set found in setStatusMany").toBeDefined();

    const keys = set!
      .split(",")
      .map((part) => part.split(":")[0]?.trim())
      .filter(Boolean);
    expect(keys.sort()).toEqual(["status", "updatedAt"]);
  });

  it("an edit cannot write the review aggregate back", () => {
    // A form opened before a moderation decision would otherwise carry the old
    // figures and undo it.
    const fn = bodyOf(service, "export async function updateProduct(");
    expect(fn).toContain("rating: existing.rating");
    expect(fn).toContain("reviewCount: existing.reviewCount");
    expect(fn).toContain("createdAt: existing.createdAt");
  });

  it("replaceAll survives only for a whole-collection restore", () => {
    const repository = read("features/products/server/product.repository.ts");
    // The comment must warn, and no service mutation may call it.
    expect(repository).toContain("Only for a restore-from-backup");
    expect(stripComments(service)).not.toContain("replaceAll");
  });
});

/**
 * Bulk Publish sent a full product body per selected cake, rebuilt from the
 * browser's list — a snapshot. Every field another admin had changed since that
 * list loaded was written back to its old value, ten times over for ten rows.
 */
describe("bulk publish sends ids, not snapshots", () => {
  const page = read("apps/admin/products/components/products-list-page.tsx");

  it("the screen posts ids and a status", () => {
    const fn = bodyOf(page, "async function applyBulkStatus(");
    expect(fn).toContain("setProductStatusRequest(ids, status)");
    expect(fn).not.toContain("updateProductRequest");
    // The give-away shape: rebuilding a form body from a cached row.
    expect(fn).not.toMatch(/\.\.\.data,\s*status/);
  });

  it("it reports what the server actually changed", () => {
    const fn = bodyOf(page, "async function applyBulkStatus(");
    // Fewer rows changed than selected means something was deleted or already in
    // that state — saying "10 published" then would be a number nobody produced.
    expect(fn).toContain("const missed = ids.length - updated");
  });

  it("the endpoint requires an admin and validates its input", () => {
    const route = read("app/api/products/status/route.ts");
    expect(route).toContain("requireProductAdmin()");
    expect(route).toContain("validate(bodySchema");
    expect(route).toContain("writeAuditLog");
  });
});

/**
 * The slug IS the storefront's product URL. A scan-then-write is a check two
 * concurrent requests can both pass, and the collection carried a plain
 * `slug_1`, so nothing stopped the collision.
 */
describe("slug uniqueness is the database's job", () => {
  it("the schema declares it", () => {
    const model = read("lib/server/db/models/product.model.ts");
    expect(model).toMatch(/slug:\s*\{[^}]*unique:\s*true/);
  });

  it("an existing non-unique index is replaced rather than left alone", () => {
    // Declaring `unique` is not enough on a collection that already has a plain
    // `slug_1` — autoIndex leaves it. The live collection still reported
    // `unique: undefined` after the schema change.
    const fn = bodyOf(read("features/products/server/product.repository.ts"), "function ensureUniqueSlugIndex(");
    expect(fn).toContain("dropIndex");
    expect(fn).toContain("createIndex");
    expect(fn).toMatch(/unique:\s*true/);
  });

  it("the write paths ensure it before writing", () => {
    const repository = read("features/products/server/product.repository.ts");
    for (const fn of ["export async function insertOne(", "export async function replaceOne("]) {
      expect(bodyOf(repository, fn)).toContain("await ensureUniqueSlugIndex()");
    }
  });

  it("the routes turn the refusal into a 409, with no pre-flight scan", () => {
    for (const file of ["app/api/products/route.ts", "app/api/products/[id]/route.ts"]) {
      const source = read(file);
      expect(source, `${file} must map the duplicate to 409`).toContain("isDuplicateSlugError(error)");
      expect(source, `${file} must not scan first`).not.toContain("slugExists(");
    }
  });

  it("recognises Mongo's duplicate-slug error and nothing else", () => {
    const duplicate = Object.assign(new Error("E11000 duplicate key error"), {
      code: 11000,
      keyPattern: { slug: 1 },
    });
    expect(isDuplicateSlugError(duplicate)).toBe(true);

    // A duplicate on a DIFFERENT key must not be reported as a slug clash.
    expect(
      isDuplicateSlugError(Object.assign(new Error("E11000"), { code: 11000, keyPattern: { _id: 1 } })),
    ).toBe(false);
    expect(isDuplicateSlugError(new Error("connection reset"))).toBe(false);
    expect(isDuplicateSlugError(null)).toBe(false);
  });
});

/** Deleting every product used to mean "not seeded yet". */
describe("the demo catalogue is seeded once, ever", () => {
  const fn = bodyOf(read("features/products/server/product.repository.ts"), "async function seedIfEmpty(");

  it("keys off a flag, not the row count", () => {
    // Keyed off the count alone, a shop that cleared the catalogue to start its
    // own got 34 published demo cakes back on the next page load, on sale.
    expect(fn).toContain("seededFlag.read()");
    expect(fn).toContain("if (flag.done) return");
  });

  it("marks a shop that already has products as seeded", () => {
    // Otherwise an existing shop is still one deletion away from the seed.
    expect(fn).toContain("seededFlag.write({ done: true })");
    const guard = fn.indexOf("if (count === 0)");
    const write = fn.indexOf("seededFlag.write({ done: true })");
    const closeGuard = fn.indexOf("\n  }", guard);
    expect(write).toBeGreaterThan(closeGuard);
  });
});

/** A rejected save has to say which field, and why. */
describe("the product client surfaces the server's field errors", () => {
  it("reads `errors` before falling back to the summary", () => {
    const fn = bodyOf(read("features/products/data/products-client.ts"), "async function request<T>(");
    expect(fn).toContain("payload?.errors");
    expect(fn).toContain("detail || payload?.error");
  });
});
