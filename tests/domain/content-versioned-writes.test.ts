import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The content endpoints are replace-all: a save sends the ENTIRE list.
 *
 * With nothing to compare against, a second admin tab — or the same tab left
 * open over lunch — sent its older list and silently reverted everything done in
 * between, and both tabs reported success. The hydration gate already refuses a
 * write from a browser that never loaded the server's copy; this refuses one
 * from a browser whose copy has aged.
 *
 * Also here: what an anonymous caller may read. The GET is public because the
 * storefront hydrates these three collections in the browser, and it used to
 * return the whole stored array — unapproved testimonials, unpublished FAQs, and
 * banners that were switched off, expired or scheduled, complete with the launch
 * time of a campaign the shop had not announced.
 */

const state = vi.hoisted(() => ({ docs: new Map<string, { data: unknown; version: number }>() }));

vi.mock("@/lib/server/db/mongoose", () => ({ connectDB: async () => ({}) }));

vi.mock("@/lib/server/db/cms-store", async () => {
  class StoreConflictError extends Error {
    readonly currentVersion: number;
    constructor(currentVersion: number) {
      super("This was changed somewhere else after you loaded it.");
      this.name = "StoreConflictError";
      this.currentVersion = currentVersion;
    }
  }

  return {
    StoreConflictError,
    hasSeeded: async () => true,
    markSeeded: async () => {},
    createMongoStore<T>(options: { key: string; seed: () => T; isValid?: (v: T) => boolean }) {
      const load = () => {
        const doc = state.docs.get(options.key);
        const usable = doc && (!options.isValid || options.isValid(doc.data as T));
        if (!usable) {
          const seeded = { data: options.seed(), version: 0 };
          state.docs.set(options.key, seeded);
          return seeded;
        }
        return doc;
      };
      return {
        read: async () => load().data as T,
        readVersioned: async () => {
          const doc = load();
          return { value: doc.data as T, version: doc.version };
        },
        writeVersioned: async (value: T, expectedVersion?: number) => {
          const doc = load();
          if (expectedVersion !== undefined && doc.version !== expectedVersion) {
            throw new StoreConflictError(doc.version);
          }
          const version = doc.version + 1;
          state.docs.set(options.key, { data: value, version });
          return { value, version };
        },
        write: async (value: T) => {
          const doc = load();
          state.docs.set(options.key, { data: value, version: doc.version });
        },
        mutate: async () => undefined,
        reset: async () => state.docs.delete(options.key),
      };
    },
  };
});

vi.mock("@/lib/server/audit/audit-log", () => ({
  writeAuditLog: vi.fn(async () => {}),
  requestContext: () => ({ ip: "", userAgent: "" }),
}));

import { StoreConflictError } from "@/lib/server/db/cms-store";
import {
  getContent,
  getContentVersioned,
  getPublicContent,
  replaceContent,
} from "@/features/content/server/content.service";

const CTX = { ip: "", userAgent: "" };

beforeEach(() => {
  state.docs.clear();
});

describe("saving a content collection", () => {
  it("refuses a save composed against a version that has moved on", async () => {
    const { version: opened } = await getContentVersioned("banners");

    // Another tab saves first.
    await replaceContent("banners", [{ id: "b1", title: "Theirs", image: "" }], CTX, opened);

    // This tab still holds the version it loaded.
    await expect(
      replaceContent("banners", [{ id: "b2", title: "Mine", image: "" }], CTX, opened),
    ).rejects.toBeInstanceOf(StoreConflictError);

    const kept = (await getContent("banners")) as { title: string }[];
    expect(kept.map((b) => b.title)).toEqual(["Theirs"]);
  });

  it("says which version is current, so the caller can recover", async () => {
    const { version: opened } = await getContentVersioned("faq");
    await replaceContent("faq", [], CTX, opened);

    await expect(replaceContent("faq", [], CTX, opened)).rejects.toMatchObject({
      currentVersion: opened + 1,
    });
  });

  it("lets the same tab save again with the version its last write produced", async () => {
    const { version: opened } = await getContentVersioned("testimonials");
    await replaceContent("testimonials", [], CTX, opened);

    const { version: now } = await getContentVersioned("testimonials");
    await expect(replaceContent("testimonials", [], CTX, now)).resolves.toBeDefined();
  });

  it("still accepts a write with no version, so nothing that cannot compare is blocked", async () => {
    await expect(replaceContent("banners", [], CTX)).resolves.toBeDefined();
  });

  it("moves the version on every write", async () => {
    const start = (await getContentVersioned("faq")).version;

    await replaceContent("faq", [], CTX);
    await replaceContent("faq", [], CTX);

    expect((await getContentVersioned("faq")).version).toBe(start + 2);
  });
});

describe("what an anonymous visitor may read", () => {
  it("hides banners that are switched off, expired or not started", async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    await replaceContent(
      "banners",
      [
        { id: "live", title: "Live", image: "", isActive: true },
        { id: "off", title: "Off", image: "", isActive: false },
        { id: "later", title: "Later", image: "", isActive: true, startDate: future },
        { id: "over", title: "Over", image: "", isActive: true, endDate: past },
      ],
      CTX,
    );

    const publicList = (await getPublicContent("banners")) as { id: string }[];

    expect(publicList.map((b) => b.id)).toEqual(["live"]);
    // The admin still sees all four.
    expect(((await getContent("banners")) as unknown[]).length).toBe(4);
  });

  it("does not leak the launch date of an unannounced campaign", async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    await replaceContent(
      "banners",
      [{ id: "later", title: "Diwali", image: "", isActive: true, startDate: future }],
      CTX,
    );

    expect(JSON.stringify(await getPublicContent("banners"))).not.toContain(future);
  });

  it("hides testimonials the admin has not approved", async () => {
    await replaceContent(
      "testimonials",
      [
        { id: "a", name: "A", content: "", status: "published" },
        { id: "b", name: "B", content: "", status: "draft" },
      ],
      CTX,
    );

    expect(((await getPublicContent("testimonials")) as { id: string }[]).map((t) => t.id)).toEqual(
      ["a"],
    );
  });

  it("hides unpublished FAQs", async () => {
    await replaceContent(
      "faq",
      [
        { id: "a", question: "Q", answer: "", status: "published" },
        { id: "b", question: "Q", answer: "", status: "draft" },
      ],
      CTX,
    );

    expect(((await getPublicContent("faq")) as { id: string }[]).map((f) => f.id)).toEqual(["a"]);
  });
});
