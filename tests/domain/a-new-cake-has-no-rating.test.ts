import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A cake nobody has reviewed does not have four and a half stars.
 *
 * `createEmptyProductForm` defaulted `rating: 4.5`, and `createProduct` wrote
 * the form's values into the document verbatim — unlike `updateProduct`, which
 * re-imposes the stored values with a comment explaining exactly why: "`rating`
 * and `reviewCount` are owned by the reviews aggregate, which writes them
 * directly."
 *
 * So every cake an admin added went on sale advertising 4.5 ★ on its card and
 * its product page, with nothing behind it. Worse than a cosmetic lie: the
 * shop's first honest review DROPPED the visible rating, because the aggregate
 * replaced the invented number with the real one.
 */

const inserted: Record<string, unknown>[] = [];

/**
 * The whole repository surface `products-service` reaches for, so the mock does
 * not depend on which functions a given test happens to touch — and importing
 * the service opens no database connection.
 */
vi.mock("@/features/products/server/product.repository", () => ({
  insertOne: async (doc: Record<string, unknown>) => {
    inserted.push(doc);
    return doc;
  },
  replaceOne: async (_id: string, doc: Record<string, unknown>) => doc,
  deleteOne: async () => true,
  setStatusMany: async () => 0,
  findById: async () => null,
  findAll: async () => [],
}));

/**
 * Imported STATICALLY, not with `await import()` inside the cases.
 *
 * `vi.mock` is hoisted above these, so a static import resolves against the
 * mocked graph deterministically. The dynamic version raced the module graph
 * under a parallel full-suite run and failed roughly one run in three — a test
 * that fails at random is worse than no test, because it teaches everyone to
 * re-run rather than read it.
 */
import { createProduct } from "@/features/products/data/products-service";
import { createEmptyProductForm } from "@/features/products/lib/products-repository";

beforeEach(() => {
  inserted.length = 0;
});

describe("a newly created product", () => {
  it("is stored unrated, whatever the form carried", async () => {
    await createProduct({
      name: "Pistachio Rose",
      slug: "pistachio-rose",
      // What the form defaulted to, and what an admin could type by hand.
      rating: 4.5,
      reviewCount: 12,
    } as never);

    expect(inserted, "createProduct did not reach the repository").toHaveLength(1);
    expect(inserted[0].rating, "a new cake advertised a rating nobody gave it").toBe(0);
    expect(inserted[0].reviewCount, "a new cake claimed reviews it does not have").toBe(0);
  });
});

describe("the new-product form", () => {
  it("does not suggest a rating to begin with", () => {
    const form = createEmptyProductForm();

    expect(form.rating, "the blank form started at 4.5 stars").toBe(0);
    expect(form.reviewCount).toBe(0);
  });
});
