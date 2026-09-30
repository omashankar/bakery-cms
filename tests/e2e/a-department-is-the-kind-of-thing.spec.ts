import { expect, test } from "@playwright/test";

import { adminSession } from "./admin-session";
import { connect } from "./shop-state";

/**
 * A SHOP CAN SAY WHAT KIND OF THING IT SELLS.
 *
 * The catalogue had three flat lists — categories, occasions, collections —
 * and no way to say that Chocolate Cakes belongs under CAKES and Smartphones
 * under MOBILES. A shop that sells a dozen kinds of thing had one
 * undifferentiated pile.
 *
 * WHAT THIS PROVES, AND WHAT IT DOES NOT.
 *
 * It proves the whole path end to end: the tab exists, the picker offers the
 * shop's own categories rather than the shipped demo ones, the write reaches
 * the database, and its members arrive with it.
 *
 * It does NOT prove the strict-schema half. Removing `departments` from the
 * Mongoose model and re-running this spec left it GREEN — Mongoose caches a
 * registered model for the life of the process, so the dev server was still
 * using the schema it compiled before the edit. Measured, not assumed. That
 * half is proven in a-shop-can-sell-more-than-one-kind-of-thing.test.ts, in a
 * fresh schema built both ways in one process.
 *
 * It creates a department and DELETES IT AGAIN by the id it created, never by
 * a query: the shop's own seven categories are in this document and a
 * query-shaped cleanup is how a probe takes something real with it.
 */
test("a department is created, stored, and filled with the shop's own categories", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const db = await connect();
  const stores = db.collection("catalogs");

  /* What the document held before, so the cleanup can prove it put it back. */
  const before = await stores.findOne({});
  const departmentsBefore = (before?.departments ?? []) as { id: string }[];
  const categoriesBefore = (before?.categories ?? []) as { id: string; name: string }[];
  expect(categoriesBefore.length, "no categories to file").toBeGreaterThan(0);

  let createdId: string | undefined;

  try {
    await adminSession(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/admin/catalog");
    await page.waitForLoadState("networkidle");

    const tab = page.getByRole("button", { name: /departments/i }).first();
    await expect(tab, "the Catalog screen has no Departments tab").toBeVisible({
      timeout: 60_000,
    });
    await tab.click();

    await page.getByRole("button", { name: /add/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    /*
      THE SHOP'S OWN CATEGORIES, not the shipped demo ones.

      This is the assertion that caught the first version: the picker read the
      browser's catalogue cache before it had been filled from the server, so
      it offered Cupcakes and Custom Cakes to a shop that has neither while its
      seven real ones were on the page behind the dialog.
    */
    const firstCategory = categoriesBefore[0].name;
    await expect(
      dialog.getByText(firstCategory, { exact: true }),
      `the picker does not offer "${firstCategory}", which this shop actually has`,
    ).toBeVisible({ timeout: 30_000 });

    await dialog.getByLabel(/^name$/i).fill("Probe Department");
    await dialog.getByRole("checkbox").first().check();
    await dialog.getByRole("button", { name: /^(save|create|add)/i }).last().click();
    await expect(dialog).toBeHidden({ timeout: 30_000 });

    /*
      AND IT REACHED THE DATABASE WITH ITS MEMBERS. The schema is strict: an
      undeclared path is dropped on write and the API still answers 200, so
      reading it back is the only thing that proves the column exists.
    */
    await expect
      .poll(
        async () => {
          const doc = await stores.findOne({});
          const rows = (doc?.departments ?? []) as { name: string; categoryIds?: string[] }[];
          return rows.find((row) => row.name === "Probe Department")?.categoryIds?.length ?? 0;
        },
        { timeout: 30_000, message: "the department never reached the database with its members" },
      )
      .toBeGreaterThan(0);

    const after = await stores.findOne({});
    const stored = ((after?.departments ?? []) as { id: string; name: string }[]).find(
      (row) => row.name === "Probe Department",
    );
    createdId = stored?.id;
    expect(createdId, "the stored department has no id to clean up by").toBeTruthy();

    /* Nothing else in the document moved. */
    const categoriesAfter = (after?.categories ?? []) as { id: string }[];
    expect(categoriesAfter.length, "creating a department changed the categories").toBe(
      categoriesBefore.length,
    );
  } finally {
    /*
      BY ID, never by a query. The shop's real rows are in this document, and
      a `deleteMany`-shaped cleanup is how a probe takes something real with
      it.
    */
    if (createdId) {
      const doc = await stores.findOne({});
      const kept = ((doc?.departments ?? []) as { id: string }[]).filter(
        (row) => row.id !== createdId,
      );
      await stores.updateOne({ _id: doc!._id }, { $set: { departments: kept } });
      const final = await stores.findOne({});
      expect(
        ((final?.departments ?? []) as { id: string }[]).length,
        "the probe left its department behind",
      ).toBe(departmentsBefore.length);
    }
  }
});
