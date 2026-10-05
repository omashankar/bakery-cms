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
        /*
          `p` AND the heading-shaped `a`, because a department sub-heading is a
          LINK to its own page now — it was a `<p>` until that page existed.
          Reading only `p` is how this case went red when the link landed,
          which is the right way round: a heading that stopped being drawn and
          a heading that became a link look identical to a narrower selector.
        */
        headings: [...panel.querySelectorAll("p, a")]
          .filter(
            (node) => node.tagName === "P" || node.className.includes("uppercase tracking-wider"),
          )
          .map((node) => (node.textContent ?? "").trim()),
        links: [...panel.querySelectorAll("a")].map((node) => (node.textContent ?? "").trim()),
        departmentHrefs: [...panel.querySelectorAll('a[href^="/store/departments/"]')].map(
          (node) => ({
            label: (node.textContent ?? "").trim(),
            href: node.getAttribute("href"),
          }),
        ),
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
      AND EACH HEADING OPENS ITS OWN DEPARTMENT. A customer who wants
      everything in one kind of thing should not have to pick a category first,
      and the pairing is asserted — not just that two links exist — because a
      heading pointing at the OTHER department's page is the mistake a shared
      index would make.
    */
    expect(
      seen!.departmentHrefs,
      "the headings do not open their own departments",
    ).toEqual([
      { label: "Probe Kind A", href: "/store/departments/probe-kind-a" },
      { label: "Probe Kind B", href: "/store/departments/probe-kind-b" },
    ]);

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
      AND IT LINKS TO THE DEPARTMENT'S OWN PAGE.

      This asserted the opposite — that the department is a word and NOT a link
      — with the reason written beside it: a crumb is a promise that a page
      exists, and there was no `/store/departments/<slug>`. There is now, so
      the promise is kept rather than avoided. The case failed on the change,
      which is what it was for.
    */
    expect(
      trail!.linked.find((entry) => entry.label === probe.name)?.href,
      `the department crumb does not open its page: ${JSON.stringify(trail!.linked)}`,
    ).toBe(`/store/departments/${probe.slug}`);
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
      `the department does not link on the category page: ${listingTrail}`,
    ).toContain(probe.name);

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

/**
 * AND THE DEPARTMENT HAS A PAGE A CUSTOMER CAN OPEN.
 *
 * Three surfaces named a department and none of them led anywhere: the menu
 * drew it as a heading, the trail above a product as a plain word, and both
 * carried a comment saying a crumb is a promise that a page exists and this
 * one did not. So the one axis that answers "what sort of shop is this" was
 * the only one with no address.
 *
 * COMPARED AGAINST THE APP, NOT AGAINST MONGO. The first version of this read
 * products with `isPublished: { $ne: false }` and demanded the grid match —
 * wrong field, since `getStorefrontProductCards` filters
 * `status === "published"`. It failed on a product the shop does not serve
 * being absent from a page that was right. Reading the database for a set a
 * page must match means re-implementing the app's own ideas of published, in
 * stock and offered, and getting any one of them wrong fails correct code.
 *
 * So the probe department holds EXACTLY ONE category, and its page must equal
 * that category's own page product for product. Both sides come from the same
 * reader, the same filters and the same 24-per-page slice, so the only thing
 * the comparison can be sensitive to is the thing under test.
 *
 * AND IT IS NOT THE WHOLE CATALOGUE, which is the way this could go wrong
 * quietly: a department is two steps from a product, so a page that listed
 * everything under the department's name would look perfectly reasonable.
 */
test("and a department has a page of its own", async ({ page }) => {
  test.setTimeout(240_000);
  const db = await connect();
  const stores = db.collection("catalogs");

  const before = await stores.findOne({});
  const departmentsBefore = (before?.departments ?? []) as { id: string }[];
  const categories = (before?.categories ?? []) as { id: string; name: string; slug: string }[];
  expect(categories.length, "no categories to file").toBeGreaterThan(0);

  /* The product slugs a page lists, deduped — a card can appear in more than
     one rail. */
  const listed = async (url: string) => {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    return page.evaluate(() => [
      ...new Set(
        [...document.querySelectorAll('a[href^="/store/p/"]')].map((node) =>
          (node.getAttribute("href") ?? "").replace("/store/p/", ""),
        ),
      ),
    ]);
  };

  /* A category the shop actually lists products under, as the shop lists them. */
  let held: { id: string; name: string; slug: string } | undefined;
  let inCategory: string[] = [];
  for (const row of categories) {
    const found = await listed(`/store/collections/${row.slug}`);
    if (found.length > 0) {
      held = row;
      inCategory = found;
      break;
    }
  }
  expect(held, "no category lists a single product").toBeTruthy();

  const wholeShop = await listed("/store/collections");
  expect(
    wholeShop.length,
    "the shop-all page lists no more than this one category, so nothing could be excluded",
  ).toBeGreaterThan(inCategory.length);

  const probe = {
    id: "probe-dept-page",
    name: "Probe Kind",
    slug: "probe-kind",
    sortOrder: 0,
    isActive: true,
    categoryIds: [held!.id],
  };

  try {
    await stores.updateOne(
      { _id: before!._id },
      { $set: { departments: [...departmentsBefore, probe] } },
    );

    await page.setViewportSize({ width: 1440, height: 1000 });
    const inDepartment = await listed(`/store/departments/${probe.slug}`);

    const seen = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Breadcrumb"]');
      return {
        /* innerText, not textContent: the page's RSC payload is in the DOM. */
        trail: nav
          ? (nav as HTMLElement).innerText
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
          : null,
        title: document.title,
      };
    });

    /* THE PAGE IS THERE, headed and trailed in the shop's own word. */
    expect(seen.trail, "the department page has no breadcrumb").toEqual(["Home", probe.name]);
    expect(seen.title, "the tab is not named after the department").toContain(probe.name);

    /* AND ITS GRID IS THE ONE CATEGORY IT HOLDS — exactly. */
    expect([...inDepartment].sort(), `the department's grid is not its category's`).toEqual(
      [...inCategory].sort(),
    );
    expect(
      inDepartment.length,
      "the department page lists the whole shop",
    ).toBeLessThan(wholeShop.length);

    /*
      AND A DEPARTMENT WITH NOTHING FILED UNDER IT GETS NO PAGE.

      `offeredAxes` drops a department whose `categoryIds` is empty, so this
      address falls through to the plain listing exactly as an unknown slug
      does. That is the right answer and not an oversight: a page headed
      "Flowers" over the whole catalogue is a claim about the shop that is not
      true, and the shop has not said what is in Flowers yet.
    */
    await stores.updateOne(
      { _id: before!._id },
      {
        $set: {
          departments: [...departmentsBefore, { ...probe, categoryIds: [] }],
        },
      },
    );
    await page.goto(`/store/departments/${probe.slug}`);
    await page.waitForLoadState("networkidle");
    const emptied = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Breadcrumb"]');
      return nav ? (nav as HTMLElement).innerText.trim() : null;
    });
    expect(
      emptied,
      `an empty department was given a page of its own: ${emptied}`,
    ).not.toContain(probe.name);

    /* Put the filled one back for the crumb check below. */
    await stores.updateOne(
      { _id: before!._id },
      { $set: { departments: [...departmentsBefore, probe] } },
    );

    /* AND THE PRODUCT'S OWN TRAIL LINKS BACK TO IT. */
    await page.goto(`/store/p/${inCategory[0]}`);
    await page.waitForLoadState("networkidle");
    const crumb = await page.evaluate(() =>
      [...document.querySelectorAll('nav[aria-label="Breadcrumb"] a')].map((node) => ({
        label: (node.textContent ?? "").trim(),
        href: node.getAttribute("href"),
      })),
    );
    expect(
      crumb.find((entry) => entry.label === probe.name)?.href,
      `the product trail does not link the department: ${JSON.stringify(crumb)}`,
    ).toBe(`/store/departments/${probe.slug}`);
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
