import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { submitReviewSchema } from "@/features/reviews/server/review.validators";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

/**
 * `POST /api/reviews` has no session — it is the storefront's review form.
 *
 * It used to take `id` from the request body and hand it to a repository that
 * upserted on it, so an anonymous request carrying an existing id rewrote that
 * review in place. Because the service forces `status: "pending"`, rewriting an
 * approved review also removed it from the product page. Seeded ids are
 * `review-seed-<product-slug>-<n>`, so there was nothing to guess.
 *
 * Proved against a running shop before the fix: an approved 4-star review by
 * "Ananya Patel" came back as a 1-star by "Not The Real Reviewer", pending.
 */
describe("public review submission cannot address an existing review", () => {
  const submission = {
    productSlug: "chocolate-truffle",
    authorName: "Priya",
    rating: 5,
    body: "Delicious!",
  };

  it("still accepts an ordinary submission", () => {
    expect(submitReviewSchema.safeParse(submission).success).toBe(true);
  });

  it("drops a caller-supplied id instead of carrying it to the write", () => {
    const parsed = submitReviewSchema.parse({
      ...submission,
      id: "review-seed-eggless-red-velvet-2",
    });

    // The assertion is on the PARSED value, not on `success`. zod is non-strict,
    // so an unknown key leaves `success` true either way — a test that only
    // checked `success` would pass just as happily with `id` back in the schema.
    expect(parsed).not.toHaveProperty("id");
  });

  it("drops caller-supplied timestamps", () => {
    // `createdAt` is the sort key for the storefront list AND the moderation
    // queue, so accepting it let a submitter pin themselves to the top of both.
    const parsed = submitReviewSchema.parse({
      ...submission,
      createdAt: "2099-01-01T00:00:00.000Z",
      updatedAt: "2099-01-01T00:00:00.000Z",
    });

    expect(parsed).not.toHaveProperty("createdAt");
    expect(parsed).not.toHaveProperty("updatedAt");
  });

  it("mints the id server-side rather than reading one from the input", () => {
    const source = read("features/reviews/server/review.service.ts");
    const submit = source.slice(source.indexOf("export async function submitReview"));
    const bodyEnd = submit.indexOf("\n}");
    const fn = submit.slice(0, bodyEnd > 0 ? bodyEnd : undefined);

    // Anchored to the function body, and asserted BOTH ways: the id must be
    // generated, and must not fall back to anything off `input`.
    expect(fn).toMatch(/id:\s*`review-\$\{randomUUID\(\)\}`/);
    expect(fn).not.toMatch(/input\.id/);
    expect(fn).not.toMatch(/input\.createdAt/);
    expect(fn).not.toMatch(/input\.updatedAt/);
  });

  it("creates rather than upserts, so an id collision cannot overwrite", () => {
    const source = read("features/reviews/server/review.repository.ts");
    const create = source.slice(source.indexOf("export async function create("));
    const fn = create.slice(0, create.indexOf("\n}"));

    expect(fn).toContain("ReviewModel.create(");
    // The specific shape that made this exploitable.
    expect(fn).not.toContain("upsert");
    expect(fn).not.toContain("updateOne");
  });
});

/**
 * The same endpoint's READ side. `GET /api/reviews?productSlug=` is public and
 * the slugs are public, so returning the whole document made the shop's customer
 * email addresses harvestable with one unauthenticated request.
 */
describe("the public review read publishes only what the page renders", () => {
  const source = read("features/reviews/server/review.repository.ts");
  const fields = source.slice(
    source.indexOf("const PUBLIC_REVIEW_FIELDS"),
    source.indexOf("export async function listApprovedByProduct"),
  );

  it("never names the private fields", () => {
    expect(fields).not.toContain("authorEmail");
    expect(fields).not.toContain("reportReason");
  });

  it("still names the fields the product page needs", () => {
    // Without this half, deleting the whole projection would pass the test above.
    for (const field of ["authorName", "rating", "body", "title", "adminReply", "createdAt"]) {
      expect(fields).toContain(field);
    }
  });

  it("applies the projection to the public query", () => {
    const fn = source.slice(source.indexOf("export async function listApprovedByProduct"));
    expect(fn.slice(0, fn.indexOf("\n}"))).toContain(".select(PUBLIC_REVIEW_FIELDS)");
  });
});

/**
 * `GET /api/products` was open and unfiltered, and `proxy.ts` excludes `/api`
 * from its matcher — so an anonymous caller received drafts and archived items
 * in full. Verified live: 25 products to an admin, 24 published to a stranger.
 */
describe("product reads do not hand out unpublished work", () => {
  it("filters the collection read for anonymous callers", () => {
    const source = read("app/api/products/route.ts");
    const get = source.slice(source.indexOf("export async function GET"));
    const fn = get.slice(0, get.indexOf("\nexport async function POST"));

    expect(fn).toContain("requireProductAdmin()");
    expect(fn).toMatch(/status === "published"/);
  });

  it("refuses an unpublished product by id, and says 404 rather than 403", () => {
    const source = read("app/api/products/[id]/route.ts");
    const get = source.slice(source.indexOf("export async function GET"));
    const fn = get.slice(0, get.indexOf("\nexport async function PUT"));

    expect(fn).toMatch(/product\.status !== "published"/);
    expect(fn).toContain("requireProductAdmin()");
    // 403 would confirm the product exists; the guard has to answer 404.
    expect(fn).not.toContain("403");
  });
});
