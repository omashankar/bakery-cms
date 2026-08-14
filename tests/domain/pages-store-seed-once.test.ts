import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Deleting every CMS page must leave no CMS pages.
 *
 * The store declared `isValid: (pages) => Array.isArray(pages) && pages.length > 0`,
 * and `createMongoStore` treats an invalid stored value exactly as a missing one
 * — it re-seeds and writes the seed back. So an empty page list was
 * indistinguishable from a shop that had never been set up, and an admin who
 * deleted the four shipped demo pages got all four back on the very next read,
 * written to the database and served to customers again.
 *
 * Verified against the running shop before the fix: the store was emptied, one
 * read returned four pages and persisted them.
 *
 * The mock below reproduces `createMongoStore`'s real seeding rule exactly —
 * including that an `isValid` failure is treated as absence — so a test that
 * skipped that detail could not catch the bug.
 */

const state = vi.hoisted(() => ({ stores: new Map<string, unknown>() }));

vi.mock("@/lib/server/db/cms-store", () => ({
  createMongoStore<T>(options: {
    key: string;
    seed: () => T;
    isValid?: (value: T) => boolean;
  }) {
    const readRaw = (): T | null => {
      if (!state.stores.has(options.key)) return null;
      const value = state.stores.get(options.key) as T;
      // The real store's rule: an invalid stored value reads as absent.
      if (options.isValid && !options.isValid(value)) return null;
      return value;
    };
    const read = async (): Promise<T> => {
      const stored = readRaw();
      if (stored !== null) return stored;
      const seeded = options.seed();
      state.stores.set(options.key, seeded);
      return seeded;
    };
    return {
      read,
      write: async (value: T) => {
        state.stores.set(options.key, value);
      },
      mutate: async <R,>(mutator: (current: T) => { next: T; result: R }) => {
        const { next, result } = mutator(await read());
        state.stores.set(options.key, next);
        return result;
      },
      reset: async () => {
        state.stores.delete(options.key);
      },
    };
  },
  hasSeeded: async () => true,
  markSeeded: async () => {},
}));

import {
  createPage,
  deletePage,
  getPages,
  getPageForStorefront,
  updatePage,
} from "@/features/content/data/pages.server";

describe("the CMS pages store", () => {
  beforeEach(() => {
    state.stores.clear();
  });

  it("seeds a brand new shop", async () => {
    const pages = await getPages();

    expect(pages.length).toBeGreaterThan(0);
  });

  it("stays empty after the admin deletes every page", async () => {
    const seeded = await getPages();
    expect(seeded.length).toBeGreaterThan(0);

    for (const page of seeded) {
      expect(await deletePage(page.id)).toBe(true);
    }

    expect(await getPages()).toEqual([]);
  });

  it("keeps it empty across repeated reads", async () => {
    for (const page of await getPages()) await deletePage(page.id);

    expect(await getPages()).toEqual([]);
    expect(await getPages()).toEqual([]);
    expect(await getPages()).toEqual([]);
  });

  it("does not resurrect a page the admin deleted by URL either", async () => {
    const [first] = await getPages();
    const slug = first.slug;

    for (const page of await getPages()) await deletePage(page.id);

    expect(await getPageForStorefront(slug)).toBeNull();
  });

  it("still seeds when the stored value is not an array", async () => {
    state.stores.set("pages", { oops: true });

    expect((await getPages()).length).toBeGreaterThan(0);
  });

  describe("a scheduled publish", () => {
    async function schedule(when: string) {
      for (const page of await getPages()) await deletePage(page.id);
      const page = await createPage({
        title: "Diwali offers",
        slug: "diwali",
        status: "draft",
        scheduledPublishAt: when,
      } as never);
      return page;
    }

    it("goes live once its moment has passed", async () => {
      // The editor promises this — "auto-publishes when due in admin or
      // storefront" — and the list shows a Scheduled badge. Nothing acted on it:
      // the one function that would have lives in the dead browser repository
      // with no caller, and the server read only ever asked whether the status
      // was already "published". The page 404d at its launch time and forever.
      await schedule(new Date(Date.now() - 60_000).toISOString());

      const live = await getPageForStorefront("diwali");

      expect(live).not.toBeNull();
      expect(live?.status).toBe("published");
    });

    it("clears the schedule once it has fired, so it is not reprocessed", async () => {
      await schedule(new Date(Date.now() - 60_000).toISOString());

      await getPageForStorefront("diwali");
      const [page] = await getPages();

      expect(page.scheduledPublishAt).toBeUndefined();
    });

    it("stays a draft until then", async () => {
      await schedule(new Date(Date.now() + 60 * 60_000).toISOString());

      expect(await getPageForStorefront("diwali")).toBeNull();
      expect((await getPages())[0].status).toBe("draft");
    });

    it("leaves an archived page alone even if it carries a past date", async () => {
      const page = await schedule(new Date(Date.now() - 60_000).toISOString());
      await updatePage(page.id, { status: "archived" } as never);

      await getPages();

      expect((await getPages())[0].status).toBe("archived");
    });

    it("does not publish a page with no schedule at all", async () => {
      for (const item of await getPages()) await deletePage(item.id);
      await createPage({ title: "Careers", slug: "careers", status: "draft" } as never);

      expect(await getPageForStorefront("careers")).toBeNull();
    });
  });

  describe("where a new page lands in the order", () => {
    it("goes last, counted from what the shop actually has", async () => {
      // The form defaulted this from the browser cache — the four-page demo
      // seed, never the real list — so a shop with twenty pages defaulted every
      // new page to 5 and they collided in the middle of the admin's order.
      for (const page of await getPages()) await deletePage(page.id);
      for (const order of [1, 2, 3, 4, 5, 6, 7]) {
        await createPage({
          title: `p${order}`,
          slug: `p${order}`,
          status: "draft",
          sortOrder: order,
        } as never);
      }

      const created = await createPage({
        title: "newest",
        slug: "newest",
        status: "draft",
        sortOrder: 0,
      } as never);

      expect(created.sortOrder).toBe(8);
    });

    it("keeps a position the admin typed", async () => {
      const created = await createPage({
        title: "second",
        slug: "second",
        status: "draft",
        sortOrder: 2,
      } as never);

      expect(created.sortOrder).toBe(2);
    });

    it("treats a missing or nonsensical order as 'last'", async () => {
      for (const page of await getPages()) await deletePage(page.id);
      await createPage({ title: "a", slug: "a", status: "draft", sortOrder: 4 } as never);

      for (const bad of [undefined, 0, -3, Number.NaN]) {
        const created = await createPage({
          title: `x${String(bad)}`,
          slug: `x${String(bad)}`,
          status: "draft",
          sortOrder: bad,
        } as never);
        expect(created.sortOrder).toBeGreaterThan(4);
      }
    });
  });

  it("keeps a shop's own pages once it has any", async () => {
    for (const page of await getPages()) await deletePage(page.id);

    const mine = await createPage({
      title: "Our story",
      slug: "our-story",
      status: "published",
    } as never);

    const pages = await getPages();
    expect(pages).toHaveLength(1);
    expect(pages[0].id).toBe(mine.id);
  });
});
