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

/**
 * AND THE SHOP'S HEADER ACTUALLY CUTS ITS CATEGORY LIST BY THEM.
 *
 * The case above proves the admin half: the tab writes, and the write reaches
 * the database with its members. It says nothing about the half a customer
 * sees, and that half is the entire point of the change.
 *
 * IT CANNOT BE PROVEN WITHOUT A DEPARTMENT EXISTING. This shop has none — it
 * sells one kind of thing — so the no-department path is the only one its
 * storefront can be observed on, and that path is exactly the one that must
 * look unchanged. So this writes two departments, looks, and takes them away
 * again by the ids it created.
 *
 * WRITTEN STRAIGHT TO THE COLLECTION, not through the admin screen, and
 * deliberately: the screen is already proven above, and going through it again
 * would make a storefront failure indistinguishable from an admin one. The row
 * shape is the one the case above observed being stored.
 *
 * THE PANEL IS `invisible` UNTIL HOVER, so its text is read with
 * `textContent` on the panel ELEMENT rather than `innerText`, which returns
 * nothing for a hidden subtree. Scoped to the panel, so the page's RSC payload
 * — which `document.body.textContent` would include — cannot answer for it.
 */
test("and the shop's header cuts its category list by them", async ({ page }) => {
  test.setTimeout(240_000);
  const db = await connect();
  const stores = db.collection("catalogs");

  const before = await stores.findOne({});
  const departmentsBefore = (before?.departments ?? []) as { id: string }[];
  const categories = (before?.categories ?? []) as { id: string; name: string }[];
  expect(categories.length, "no categories to file").toBeGreaterThan(2);

  /*
    TWO DEPARTMENTS, because one proves nothing: a single section with a single
    heading over the whole list is indistinguishable from the flat list with a
    heading added, and would pass whatever the partitioning did. Two, with the
    SECOND one declared first, also proves the order is the shop's `sortOrder`
    and not the order the rows happen to sit in.
  */
  const second = {
    id: "probe-dept-b",
    name: "Probe Kind B",
    slug: "probe-kind-b",
    sortOrder: 1,
    isActive: true,
    categoryIds: [categories[2].id],
  };
  const first = {
    id: "probe-dept-a",
    name: "Probe Kind A",
    slug: "probe-kind-a",
    sortOrder: 0,
    isActive: true,
    categoryIds: [categories[0].id, categories[1].id],
  };
  const createdIds = [first.id, second.id];

  try {
    await stores.updateOne(
      { _id: before!._id },
      { $set: { departments: [...departmentsBefore, second, first] } },
    );

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/store");
    await page.waitForLoadState("networkidle");

    const seen = await page.evaluate(() => {
      const panel = document.querySelector("[data-mega-panel]");
      if (!panel) return null;
      return {
        headings: [...panel.querySelectorAll("p")].map((node) => (node.textContent ?? "").trim()),
        links: [...panel.querySelectorAll("a")].map((node) => (node.textContent ?? "").trim()),
      };
    });
    expect(seen, "the header has no mega panel to read").not.toBeNull();

    /*
      THE DEPARTMENT IS A HEADING, under the column's own heading and not
      instead of it.
    */
    expect(seen!.headings, "the department is not a heading in the panel").toContain(
      "Probe Kind A",
    );
    expect(seen!.headings).toContain("Probe Kind B");
    const columnAt = seen!.headings.findIndex((text) => /^Shop by /.test(text));
    expect(columnAt, "the category column lost its own heading").toBeGreaterThanOrEqual(0);
    expect(
      seen!.headings.indexOf("Probe Kind A"),
      "the department replaced the column heading instead of sitting under it",
    ).toBeGreaterThan(columnAt);

    /* IN THE SHOP'S ORDER, which is `sortOrder` and not the stored order. */
    expect(
      seen!.headings.indexOf("Probe Kind A"),
      "the sections came out in the order the rows were stored",
    ).toBeLessThan(seen!.headings.indexOf("Probe Kind B"));

    /*
      AND NO BLANK HEADING. The categories these two do not claim become an
      unheaded section, which must draw NOTHING rather than an empty line — the
      state every other shop's header is in today.
    */
    expect(
      seen!.headings.filter((text) => text === ""),
      "an unclaimed section drew an empty heading",
    ).toHaveLength(0);

    /* Every category still reachable, each exactly once. */
    for (const category of categories) {
      const times = seen!.links.filter((text) => text === category.name).length;
      expect(times, `"${category.name}" appears ${times} times in the panel`).toBe(1);
    }
  } finally {
    /* BY ID. The shop's own rows are in this document. */
    const doc = await stores.findOne({});
    const kept = ((doc?.departments ?? []) as { id: string }[]).filter(
      (row) => !createdIds.includes(row.id),
    );
    await stores.updateOne({ _id: doc!._id }, { $set: { departments: kept } });

    const final = await stores.findOne({});
    expect(
      ((final?.departments ?? []) as { id: string }[]).length,
      "the probe left a department behind",
    ).toBe(departmentsBefore.length);
    expect(
      ((final?.categories ?? []) as { id: string }[]).length,
      "the probe changed the shop's categories",
    ).toBe(categories.length);
  }
});

/**
 * AND THE TRAIL ABOVE A PRODUCT NAMES IT TOO.
 *
 * `app/(storefront)/store/p/[slug]/page.tsx` asks `departmentFor` and hands the
 * answer down as `departmentCrumb`, so the trail reads
 *
 *   Home › <department> › <category> › <this product>
 *
 * That wiring has never been SEEN. It cannot be: this shop keeps no
 * departments, so every product's trail is Home › category › product and the
 * middle crumb this exists for is unreachable. It shipped against unit cases
 * over the rule and a type that admits the prop — neither of which can tell
 * the prop being dropped on the floor from the prop arriving.
 *
 * THE DEPARTMENT IS A WORD, NOT A LINK, and that is asserted rather than
 * assumed: a department has no page of its own, and a crumb is a promise that
 * one exists. The category beside it IS a link, which is what makes "not a
 * link" a decision instead of a trail that forgot to link anything.
 *
 * AND IT PROVES THE TWO SURFACES AGREE. The menu files a category under
 * `departmentFor`'s answer and so does this; the same probe department is read
 * by both, so a rule written out twice would show up here as a trail naming one
 * department and a menu heading naming another.
 */
test("and the trail above a product names the department too", async ({ page }) => {
  test.setTimeout(240_000);
  const db = await connect();
  const stores = db.collection("catalogs");

  const before = await stores.findOne({});
  const departmentsBefore = (before?.departments ?? []) as { id: string }[];
  const categories = (before?.categories ?? []) as { id: string; name: string; slug: string }[];

  /*
    A PRODUCT THE SHOP ACTUALLY PUBLISHES, and the category its own
    `categoryIds[0]` names — the route resolves the crumb by id and primary
    first, so picking any other category here would prove nothing about what it
    does.
  */
  const product = (await db.collection("products").findOne({
    isPublished: { $ne: false },
    categoryIds: { $exists: true, $ne: [] },
  })) as { slug: string; name: string; categoryIds: string[] } | null;
  expect(product, "no published product is filed under a category").not.toBeNull();

  const category = categories.find((row) => row.id === product!.categoryIds[0]);
  expect(category, "the product's primary category is not in the catalogue").toBeTruthy();

  const probe = {
    id: "probe-dept-trail",
    name: "Probe Kind",
    slug: "probe-kind",
    sortOrder: 0,
    isActive: true,
    categoryIds: [category!.id],
  };

  try {
    await stores.updateOne(
      { _id: before!._id },
      { $set: { departments: [...departmentsBefore, probe] } },
    );

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/store/p/${product!.slug}`);
    await page.waitForLoadState("networkidle");

    const trail = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Breadcrumb"]');
      if (!nav) return null;
      return {
        /* innerText, not textContent: the page's RSC payload is in the DOM. */
        words: (nav as HTMLElement).innerText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        linked: [...nav.querySelectorAll("a")].map((node) => ({
          label: (node.textContent ?? "").trim(),
          href: node.getAttribute("href"),
        })),
      };
    });
    expect(trail, "the product page has no breadcrumb").not.toBeNull();

    const joined = trail!.words.join(" / ");

    /* THE DEPARTMENT IS THERE, between Home and the category. */
    const at = trail!.words.indexOf(probe.name);
    expect(at, `the department is not in the trail: ${joined}`).toBeGreaterThan(-1);
    expect(trail!.words.indexOf("Home"), `Home is not first: ${joined}`).toBe(0);
    expect(at, `the department does not follow Home: ${joined}`).toBe(1);
    expect(
      trail!.words.indexOf(category!.name),
      `the category does not follow the department: ${joined}`,
    ).toBe(2);

    /* AND THE PRODUCT IS LAST, which is the crumb a customer is standing on. */
    expect(trail!.words.at(-1), `the product is not the last crumb: ${joined}`).toBe(
      product!.name,
    );
    expect(trail!.words, `the trail is not four deep: ${joined}`).toHaveLength(4);

    /*
      AND IT IS A WORD, NOT A LINK — while the category beside it is a link, so
      this is a decision and not a trail that linked nothing.
    */
    expect(
      trail!.linked.map((entry) => entry.label),
      `the department is a link, and it has no page: ${JSON.stringify(trail!.linked)}`,
    ).not.toContain(probe.name);
    expect(
      trail!.linked.find((entry) => entry.label === category!.name)?.href,
      "the category crumb is not a link to its own page",
    ).toBe(`/store/collections/${category!.slug}`);

    /*
      AND THE STEP THE CUSTOMER TAKES FROM HERE KEEPS IT.

      Clicking that category crumb — the one just asserted to be a link —
      opened a page whose trail was `Home › Roses`. The department vanished on
      the step taken to reach it, so a product page and the page it links to
      described the shop differently.

      Same probe department, read through the same `departmentFor`: a rule
      written out twice would show up here as two different words for one
      category.
    */
    await page.goto(`/store/collections/${category!.slug}`);
    await page.waitForLoadState("networkidle");

    const listing = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Breadcrumb"]');
      if (!nav) return null;
      return {
        words: (nav as HTMLElement).innerText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        linked: [...nav.querySelectorAll("a")].map((node) => (node.textContent ?? "").trim()),
      };
    });
    expect(listing, "the category page has no breadcrumb").not.toBeNull();

    const listingTrail = listing!.words.join(" / ");
    expect(listing!.words, `the category page's trail is not three deep: ${listingTrail}`).toEqual(
      ["Home", probe.name, category!.name],
    );
    expect(
      listing!.linked,
      `the department is a link on the category page: ${listingTrail}`,
    ).not.toContain(probe.name);

    /*
      AND A COLLECTION'S PAGE DOES NOT GAIN ONE.

      A collection is not filed under a department, and this page is reached by
      three different kinds of row at one address — the route resolves
      collection first. The crumb is suppressed in TWO places on purpose: the
      route only resolves it for the category case, and the page draws it only
      when the heading IS that category. Either alone would be enough today;
      together they mean a change to one cannot produce `Home › Flowers ›
      Premium Collection`, which is a sentence about a shop that is not true.
    */
    const group = (before?.collections ?? []) as { name: string; slug: string }[];
    if (group.length > 0) {
      await page.goto(`/store/collections/${group[0].slug}`);
      await page.waitForLoadState("networkidle");
      const asGroup = await page.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Breadcrumb"]');
        return nav
          ? (nav as HTMLElement).innerText
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
          : null;
      });
      expect(asGroup, `a collection page gained a department: ${JSON.stringify(asGroup)}`).toEqual([
        "Home",
        group[0].name,
      ]);
    }
  } finally {
    const doc = await stores.findOne({});
    const kept = ((doc?.departments ?? []) as { id: string }[]).filter(
      (row) => row.id !== probe.id,
    );
    await stores.updateOne({ _id: doc!._id }, { $set: { departments: kept } });

    const final = await stores.findOne({});
    expect(
      ((final?.departments ?? []) as { id: string }[]).length,
      "the probe left its department behind",
    ).toBe(departmentsBefore.length);
  }
});
