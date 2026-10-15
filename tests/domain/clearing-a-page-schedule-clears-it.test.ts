import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "CLEAR SCHEDULE" KEPT THE SCHEDULE, AND AN UNPUBLISHED PAGE PUT ITSELF BACK UP.
 *
 * The pages store publishes any draft whose `scheduledPublishAt` has passed,
 * on read. Two ways a date the admin had finished with stayed stored:
 *
 *   CLEARED  — the form set it to `undefined`, JSON dropped the key, and the
 *              server's `{ ...page, ...patch }` kept the old value.
 *   PUBLISHED EARLY — pressing Publish left the date in place; unpublishing
 *              later made the page "a draft whose moment has passed", and the
 *              next storefront read published it again.
 *
 * Same in-memory store as pages-store-seed-once.test.ts.
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

import { createPage, getPages, updatePage } from "@/features/content/data/pages.server";
import type { CmsPageFormData } from "@/types/content";

const PAST = "2020-01-01T00:00:00.000Z";
const FUTURE = "2099-01-01T00:00:00.000Z";

async function draftPage(scheduledPublishAt: string) {
  const [template] = await getPages();
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = template;
  return createPage({
    ...(rest as CmsPageFormData),
    slug: `launch-${Math.random().toString(36).slice(2)}`,
    status: "draft",
    scheduledPublishAt,
  });
}

describe("a page's schedule", () => {
  beforeEach(() => {
    state.stores.clear();
  });

  it("is removed when the admin clears it (sent as null)", async () => {
    const page = await draftPage(FUTURE);
    const saved = await updatePage(page.id, { scheduledPublishAt: null } as never);
    expect(saved?.scheduledPublishAt).toBeUndefined();
  });

  it("is removed when the page is published by hand, so unpublishing later sticks", async () => {
    const page = await draftPage(FUTURE);
    await updatePage(page.id, { status: "published" });
    // Months later the date has passed, and the admin takes the page down.
    await updatePage(page.id, { status: "draft" });

    const after = (await getPages()).find((p) => p.id === page.id);
    expect(after?.status).toBe("draft");
    expect(after?.scheduledPublishAt).toBeUndefined();
  });

  it("still publishes a draft whose untouched schedule is due", async () => {
    const page = await draftPage(PAST);
    const after = (await getPages()).find((p) => p.id === page.id);
    expect(after?.status).toBe("published");
  });
});
