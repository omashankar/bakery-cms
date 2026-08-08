import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The builder stores, exercised for real against an in-memory store.
 *
 * Two things these had to stop doing:
 *
 * 1. RESET DESTROYED THE HISTORY. The mutator ignored its `state` and returned
 *    `{ draft, published }` only, and `createMongoStore.mutate` writes with
 *    `$set: { data: value }` — replacing the whole document. So every publish
 *    snapshot the shop had ever taken went with it. The confirmation dialog
 *    promised strictly less ("Draft and published will be replaced with
 *    defaults"), so an admin who reset intending to restore last month's layout
 *    from Version History afterwards found it empty, with the layout that had
 *    been live ten seconds earlier gone for good.
 *
 * 2. RESTORE CANCELLED A SCHEDULED PUBLISH. It rebuilt the draft with no second
 *    argument, so opening History on Friday to compare against an old layout
 *    erased the Monday 09:00 launch — silently. Monday came and nothing
 *    published.
 *
 * Both stores are tested by the same table: the homepage and wedding builders
 * are near-identical twins, and a fix landing in one and not the other is the
 * most common defect in this codebase.
 */

vi.mock("@/lib/server/db/cms-store", () => {
  const stores = new Map<string, unknown>();
  return {
    __stores: stores,
    createMongoStore<T>(options: { key: string; seed: () => T }) {
      const load = (): T => {
        if (!stores.has(options.key)) stores.set(options.key, options.seed());
        return stores.get(options.key) as T;
      };
      return {
        read: async () => load(),
        write: async (value: T) => {
          stores.set(options.key, value);
        },
        mutate: async <R,>(mutator: (current: T) => { next: T; result: R }) => {
          const { next, result } = mutator(load());
          // Replace-all, exactly as the Mongo store does — a key the mutator
          // omits is a key that is gone.
          stores.set(options.key, next);
          return result;
        },
        reset: async () => {
          stores.delete(options.key);
        },
      };
    },
    hasSeeded: async () => true,
    markSeeded: async () => {},
  };
});

import * as homepage from "@/features/cms-sections/data/homepage-sections.server";
import * as wedding from "@/features/cms-sections/data/wedding-sections.server";

const FUTURE = "2027-01-01T09:00:00.000Z";

/**
 * The structural overlap the two stores share.
 *
 * Their section types differ by design (a homepage has a "hero", a wedding page
 * a "wedding-hero"), so the table is typed to what this test actually touches —
 * ids, order and content — rather than to either union.
 */
interface AnySection {
  instanceId: string;
  order: number;
  content: Record<string, unknown>;
}

interface Snapshot {
  sections: AnySection[];
  scheduledPublishAt?: string;
}

interface BuilderApi {
  what: string;
  getState: () => Promise<{ draft: Snapshot; published: Snapshot }>;
  saveDraft: (sections: AnySection[], scheduledPublishAt?: string | null) => Promise<Snapshot>;
  publish: (sections: AnySection[]) => Promise<Snapshot>;
  reset: () => Promise<unknown>;
  listRevisions: () => Promise<{ id: string; label: string; sections: AnySection[] }[]>;
  restore: (revisionId: string) => Promise<Snapshot | null>;
  resetStore: () => Promise<void>;
}

const BUILDERS: BuilderApi[] = [
  {
    what: "homepage",
    getState: homepage.getHomepageState,
    saveDraft: homepage.saveDraftSections,
    publish: homepage.publishSections,
    reset: homepage.resetHomepageSections,
    listRevisions: homepage.listHomepageRevisions,
    restore: homepage.restoreHomepageRevision,
    resetStore: homepage.resetHomepageStore,
  },
  {
    what: "wedding",
    getState: wedding.getWeddingState,
    saveDraft: wedding.saveWeddingDraft,
    publish: wedding.publishWeddingSections,
    reset: wedding.resetWeddingSections,
    listRevisions: wedding.listWeddingRevisions,
    restore: wedding.restoreWeddingRevision,
    resetStore: wedding.resetWeddingStore,
  },
].map((entry) => entry as unknown as BuilderApi);

describe.each(BUILDERS)("$what builder store", (builder) => {
  beforeEach(async () => {
    await builder.resetStore();
  });

  /** Renames the first section so a layout is identifiable across writes. */
  async function layout(marker: string) {
    const { draft } = await builder.getState();
    return draft.sections.map((section, index) =>
      index === 0
        ? { ...section, content: { ...section.content, title: marker } }
        : section,
    );
  }

  function titleOf(sections: readonly AnySection[]) {
    return sections[0]?.content?.title;
  }

  it("keeps every publish snapshot when the layout is reset", async () => {
    await builder.publish(await layout("first"));
    await builder.publish(await layout("second"));
    expect(await builder.listRevisions()).toHaveLength(2);

    await builder.reset();

    const revisions = await builder.listRevisions();
    // The two publishes survive, and the reset adds one more.
    expect(revisions.length).toBeGreaterThanOrEqual(3);
    expect(revisions.map((revision) => revision.label)).toContain(
      "Before reset to defaults",
    );
  });

  it("makes the reset itself undoable by capturing what was live", async () => {
    await builder.publish(await layout("the-live-one"));
    await builder.reset();

    const snapshot = (await builder.listRevisions()).find(
      (revision) => revision.label === "Before reset to defaults",
    );
    expect(snapshot).toBeDefined();
    expect(titleOf(snapshot!.sections)).toBe("the-live-one");

    const restored = await builder.restore(snapshot!.id);
    expect(restored).not.toBeNull();
    expect(titleOf(restored!.sections)).toBe("the-live-one");
  });

  it("leaves a pending scheduled publish alone when a revision is restored", async () => {
    await builder.publish(await layout("old"));
    const [revision] = await builder.listRevisions();

    await builder.saveDraft(await layout("in-progress"), FUTURE);
    expect((await builder.getState()).draft.scheduledPublishAt).toBe(FUTURE);

    const restored = await builder.restore(revision.id);

    expect(restored?.scheduledPublishAt).toBe(FUTURE);
    expect((await builder.getState()).draft.scheduledPublishAt).toBe(FUTURE);
  });

  it("returns a restored draft the builder will not think is unsaved", async () => {
    // The client sorts what it receives. If the stored copy is not already
    // sorted, the two disagree on `order` while the builder reports a clean
    // draft — so the server sorts before storing.
    await builder.publish(await layout("x"));
    const [revision] = await builder.listRevisions();

    const restored = await builder.restore(revision.id);

    expect(restored!.sections.map((section) => section.order)).toEqual(
      restored!.sections.map((_, index) => index),
    );
  });

  it("answers null for a revision that is not there, without touching the draft", async () => {
    await builder.saveDraft(await layout("keep-me"), null);

    expect(await builder.restore("rev-does-not-exist")).toBeNull();
    expect(titleOf((await builder.getState()).draft.sections)).toBe("keep-me");
  });
});
