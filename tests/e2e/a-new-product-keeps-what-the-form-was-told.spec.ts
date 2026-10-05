import { expect, test } from "@playwright/test";

import { adminSession } from "./admin-session";
import { connect } from "./shop-state";

/**
 * THE ADD PRODUCT SCREEN, FROM THE FIRST KEYSTROKE TO THE DATABASE.
 *
 * Three things a product carries are written by three different mechanisms,
 * and only one of them is the product's own save:
 *
 *   - the CATEGORY goes in the product document, as `categoryId` plus
 *     `categoryIds` with the primary first;
 *   - the OCCASIONS go in the same document, as a plain list;
 *   - the COLLECTIONS do not go in the product at all. Membership lives in
 *     `collection.productIds`, so ticking one on this form is a SECOND write,
 *     to a different document, after the product exists and has an id.
 *
 * A unit test can pin the third one's arithmetic and does. What it cannot see
 * is whether the form actually performs it — and the form is where the two
 * bugs found on this screen lived: it read the catalogue during render, so a
 * cold browser offered the shipped demo taxonomy, and the dialog behind it
 * refused to save a slug it had held all along.
 *
 * THIS WRITES. One DRAFT product — never on the storefront, even for the
 * seconds it exists — created through the real form and removed through the
 * real delete. The removal is half the test: deleting a product has to take its
 * id out of every collection listing it, or a group of five quietly shows four
 * for ever with nothing to say why.
 */

const NAME = "E2E fixture cake — safe to delete";
const SLUG = "e2e-fixture-cake-safe-to-delete";

/** Tick the box in the group whose label is exactly this. */
async function tick(page: import("@playwright/test").Page, name: string) {
  await page
    .locator("label")
    .filter({ hasText: new RegExp(`^${name}$`) })
    .locator('[role="checkbox"]')
    .first()
    .click();
  await page.waitForTimeout(300);
}

test("a new product keeps its category, its occasions and its collections", async ({ page }) => {
  test.setTimeout(300_000);
  await adminSession(page);
  const db = await connect();

  /* Whatever a previous run left, this one starts clean. */
  await db.collection("products").deleteMany({ slug: SLUG });

  const catalogBefore = await db.collection("catalogs").findOne({ key: "singleton" });
  const categories = (catalogBefore?.categories ?? []) as { id: string; name: string }[];
  const occasions = (catalogBefore?.occasions ?? []) as { id: string; name: string }[];
  const collections = (catalogBefore?.collections ?? []) as { id: string; name: string }[];

  if (categories.length < 2 || occasions.length < 2 || collections.length === 0) {
    test.skip(
      true,
      `this shop has ${categories.length} categories, ${occasions.length} occasions and ${collections.length} collections — not enough to tell the three apart`,
    );
    return;
  }

  const category = categories[0]!;
  /*
    A SECOND category, because the claim about ORDER cannot fail on one. The
    first version of this ticked a single category, and reversing a one-element
    array is the same array — so a mutation that put the primary last passed
    the test written to forbid it.
  */
  const alsoUnder = categories[1]!;
  const twoOccasions = occasions.slice(0, 2);
  const collection = collections[0]!;

  await page.goto("/admin/cakes/add");
  await page.waitForTimeout(6000);

  await page.getByLabel(/product name/i).fill(NAME);
  await page.waitForTimeout(400);

  /*
    The category is a SELECT and the other two are boxes, which is the shape of
    the distinction: one category is primary, and a product is for many
    occasions and in many collections.
  */
  await page
    .locator("select")
    .filter({ hasText: new RegExp(category.name) })
    .first()
    .selectOption({ label: category.name });
  await page.waitForTimeout(400);

  /* "Also show it under" appears only once a primary is chosen. */
  await tick(page, alsoUnder.name);

  for (const occasion of twoOccasions) await tick(page, occasion.name);
  await tick(page, collection.name);

  await page.getByRole("tab", { name: /price/i }).click();
  await page.waitForTimeout(700);
  await page.getByLabel(/base price/i).fill("499");
  await page.waitForTimeout(400);

  await page.getByRole("button", { name: /save as draft|save draft|save/i }).first().click();
  await page.waitForTimeout(4000);

  /* ── what landed ─────────────────────────────────────────────────── */
  const saved = await db.collection("products").findOne({ slug: SLUG });
  const toast = await page.evaluate(() =>
    [...document.querySelectorAll("[data-sonner-toast], [role=status], [role=alert]")]
      .map((node) => (node.textContent ?? "").trim())
      .join(" | "),
  );
  expect(saved, `nothing was saved. The screen said: "${toast}"`).toBeTruthy();

  try {
    expect(saved!.status, "a product saved as a draft went live").toBe("draft");
    expect(saved!.categoryId, "the primary category did not reach the product").toBe(category.id);
    expect(
      (saved!.categoryIds ?? [])[0],
      `the primary is not first in categoryIds, which every reader relies on — got ${JSON.stringify(saved!.categoryIds)}`,
    ).toBe(category.id);
    expect(
      [...(saved!.categoryIds ?? [])].sort(),
      "the second category was ticked and did not reach the product",
    ).toEqual([category.id, alsoUnder.id].sort());
    expect(
      [...(saved!.occasionIds ?? [])].sort(),
      "the occasions ticked did not reach the product",
    ).toEqual(twoOccasions.map((o) => o.id).sort());

    /* THE ONE THAT IS A SECOND WRITE, to another document entirely. */
    const catalogAfter = await db.collection("catalogs").findOne({ key: "singleton" });
    const holding = (catalogAfter?.collections ?? [])
      .filter((group: { productIds?: string[] }) =>
        (group.productIds ?? []).includes(String(saved!._id)),
      )
      .map((group: { name: string }) => group.name);

    expect(
      holding,
      `"${collection.name}" was ticked on the form and does not hold the product — the form saved the product and not its membership`,
    ).toContain(collection.name);
  } finally {
    /* ── and removing it takes the id with it ──────────────────────── */
    const id = String(saved!._id);
    const response = await page.request.delete(`/api/products/${id}`);

    const gone = await db.collection("products").findOne({ slug: SLUG });
    const catalogNow = await db.collection("catalogs").findOne({ key: "singleton" });
    const stillHolding = (catalogNow?.collections ?? []).filter(
      (group: { productIds?: string[] }) => (group.productIds ?? []).includes(id),
    );

    /* Belt and braces: this test never leaves a row behind, pass or fail. */
    await db.collection("products").deleteMany({ slug: SLUG });
    if (stillHolding.length) {
      await db.collection("catalogs").updateOne(
        { key: "singleton" },
        {
          $set: {
            collections: (catalogNow?.collections ?? []).map(
              (group: { productIds?: string[] }) => ({
                ...group,
                productIds: (group.productIds ?? []).filter((held: string) => held !== id),
              }),
            ),
          },
        },
      );
    }

    expect(response.status(), "the delete was refused").toBe(200);
    expect(gone, "the product survived its own deletion").toBeNull();
    expect(
      stillHolding.length,
      `${stillHolding.length} collection(s) still list a product that no longer exists — a group of five will quietly show four`,
    ).toBe(0);
  }
});
