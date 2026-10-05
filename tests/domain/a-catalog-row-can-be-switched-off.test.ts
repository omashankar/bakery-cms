import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A ROW CAN BE HIDDEN, AND PUT IN ORDER, WITHOUT BEING DELETED.
 *
 * Categories, occasions and collections carried a name and a slug and nothing
 * else in common. So the only way to take a category off the storefront for a
 * season was to DELETE it — which leaves every product filed under it pointing
 * at an id nothing resolves, and three of this shop's products are already in
 * that state. And the order they appeared in was the order somebody happened
 * to create them, which no screen could change.
 *
 * `isActive` and `sortOrder` are both OPTIONAL, and what absent means is the
 * whole of what these pin down: a catalogue written before either field
 * existed has to keep showing exactly what it showed. A default of "off" would
 * empty a shop's menu on upgrade; a default of "last" would reshuffle it.
 */

const CATALOG = {
  categories: [
    { id: "1", name: "Cakes", slug: "cakes" },
    { id: "2", name: "Plants", slug: "plants", isActive: false },
    { id: "3", name: "Mugs", slug: "mugs", isActive: true },
  ],
  occasions: [] as unknown[],
  collections: [] as unknown[],
};

async function readCategories(catalog: unknown) {
  vi.resetModules();
  vi.doMock("@/features/catalog/server/catalog.service", () => ({
    getCatalog: async () => catalog,
  }));
  const mod = await import("@/apps/website/lib/storefront-categories.server");
  return mod.getStorefrontCategories();
}

describe("a catalog row the shop switched off", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("is not offered to a customer", async () => {
    const rows = await readCategories(CATALOG);

    expect(rows.map((row) => row.slug)).not.toContain("plants");
  });

  it("but one that has never carried the field is", async () => {
    /*
      THE CLAIM THAT PROTECTS EVERY EXISTING SHOP. These lists are stored as
      Mixed and read with `.lean()`, so a row written before this field came
      back without it. Treating absent as off would empty the menu of every
      shop on the day this shipped.
    */
    const rows = await readCategories(CATALOG);

    expect(rows.map((row) => row.slug)).toContain("cakes");
    expect(rows.map((row) => row.slug)).toContain("mugs");
  });
});

describe("the order a shop puts its rows in", () => {
  it("is the order they come back in", async () => {
    const rows = await readCategories({
      ...CATALOG,
      categories: [
        { id: "1", name: "Third", slug: "third", sortOrder: 2 },
        { id: "2", name: "First", slug: "first", sortOrder: 0 },
        { id: "3", name: "Second", slug: "second", sortOrder: 1 },
      ],
    });

    expect(rows.map((row) => row.slug)).toEqual(["first", "second", "third"]);
  });

  it("and a row nobody has ordered sits after the ones somebody did", async () => {
    /*
      A shop that drags three rows out of eleven has ordered three rows, not
      re-ordered the list. Sorting an absent value as 0 would send the other
      eight to the top in one move.
    */
    const rows = await readCategories({
      ...CATALOG,
      categories: [
        { id: "1", name: "Unplaced", slug: "unplaced" },
        { id: "2", name: "Placed", slug: "placed", sortOrder: 5 },
      ],
    });

    expect(rows.map((row) => row.slug)).toEqual(["placed", "unplaced"]);
  });

  it("and two rows nobody ordered keep the order they were stored in", async () => {
    const rows = await readCategories({
      ...CATALOG,
      categories: [
        { id: "1", name: "Alpha", slug: "alpha" },
        { id: "2", name: "Beta", slug: "beta" },
      ],
    });

    expect(rows.map((row) => row.slug)).toEqual(["alpha", "beta"]);
  });

  it("and decides which of two rows at one slug is the one kept", async () => {
    /*
      First row wins has always been the rule — the resolver takes the first,
      so the second is a link that does not go where its label says. What
      changed is that the shop can now say WHICH is first, so the sort has to
      run before the de-dupe rather than after it.
    */
    const rows = await readCategories({
      ...CATALOG,
      categories: [
        { id: "1", name: "Stored first", slug: "clash", sortOrder: 9 },
        { id: "2", name: "Ordered first", slug: "clash", sortOrder: 0 },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Ordered first");
  });

  it("and a switched-off row does not hold a slug against the live one", async () => {
    /*
      Hiding is not deleting, so the hidden row is still in the list — and if
      the de-dupe ran before the filter it would claim the slug and the row the
      shop left ON would disappear with it.
    */
    const rows = await readCategories({
      ...CATALOG,
      categories: [
        { id: "1", name: "Hidden", slug: "clash", isActive: false },
        { id: "2", name: "Shown", slug: "clash" },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Shown");
  });
});
