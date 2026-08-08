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

interface Written {
  snapshot: Snapshot;
  version: number;
}

interface BuilderApi {
  what: string;
  getState: () => Promise<{ draft: Snapshot; published: Snapshot; version?: number }>;
  saveDraft: (
    sections: AnySection[],
    scheduledPublishAt?: string | null,
    expectedVersion?: number,
  ) => Promise<Written>;
  publish: (sections: AnySection[], expectedVersion?: number) => Promise<Written>;
  reset: () => Promise<{ version?: number }>;
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

  describe("two people editing at once", () => {
    it("refuses a save composed against a state that has moved on", async () => {
      // Admin A opens the builder and reads version N.
      const opened = (await builder.getState()).version ?? 0;

      // Admin B saves in the meantime.
      await builder.saveDraft(await layout("B's work"), null, opened);

      // A clicks Save with the array they loaded fifteen minutes ago. This used
      // to succeed and replace B's work, with a green toast for both of them.
      await expect(
        builder.saveDraft(await layout("A's stale copy"), null, opened),
      ).rejects.toThrow(/changed somewhere else/);

      expect(titleOf((await builder.getState()).draft.sections)).toBe("B's work");
    });

    it("refuses a publish composed against a state that has moved on", async () => {
      // Worse than a stale save: it writes the stale array to `published` too,
      // so the storefront goes back in time for every visitor.
      const opened = (await builder.getState()).version ?? 0;
      await builder.saveDraft(await layout("B's work"), null, opened);

      await expect(
        builder.publish(await layout("A's stale copy"), opened),
      ).rejects.toThrow(/changed somewhere else/);

      expect(titleOf((await builder.getState()).published.sections)).not.toBe(
        "A's stale copy",
      );
    });

    it("tells the caller what the version is now, so it can say so", async () => {
      const opened = (await builder.getState()).version ?? 0;
      const { version: moved } = await builder.saveDraft(await layout("B"), null, opened);

      await expect(
        builder.saveDraft(await layout("A"), null, opened),
      ).rejects.toMatchObject({ currentVersion: moved });
    });

    it("lets the same admin save again with the version their last write returned", async () => {
      const opened = (await builder.getState()).version ?? 0;
      const first = await builder.saveDraft(await layout("one"), null, opened);
      const second = await builder.saveDraft(await layout("two"), null, first.version);

      expect(second.version).toBe(first.version + 1);
      expect(titleOf((await builder.getState()).draft.sections)).toBe("two");
    });

    it("moves the counter on every write, including reset and restore", async () => {
      // A write that left the counter alone would be invisible to the next save.
      const start = (await builder.getState()).version ?? 0;

      const published = await builder.publish(await layout("published"));
      expect(published.version).toBeGreaterThan(start);

      const afterReset = await builder.reset();
      expect(afterReset.version ?? 0).toBeGreaterThan(published.version);

      const [revision] = await builder.listRevisions();
      await builder.restore(revision.id);
      expect((await builder.getState()).version ?? 0).toBeGreaterThan(
        afterReset.version ?? 0,
      );
    });
  });
});
