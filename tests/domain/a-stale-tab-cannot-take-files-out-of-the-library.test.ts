import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MediaFile } from "@/types/media";

/**
 * A STALE TAB CANNOT TAKE FILES OUT OF THE LIBRARY.
 *
 * The library is saved whole. Tab B, opened before tab A's uploads, edits one
 * alt text and sends its list — and A's uploads used to vanish from the
 * library (still on Cloudinary, still on the products, no longer pickable).
 * A file deleted in A came back from B as a broken image.
 */
const cloudinary = vi.hoisted(() => ({ deleted: [] as string[] }));
vi.mock("@/lib/server/media/cloudinary", () => ({
  isCloudinaryConfigured: () => true,
  uploadToCloudinary: vi.fn(),
  deleteFromCloudinary: vi.fn(async (publicId: string) => {
    cloudinary.deleted.push(publicId);
  }),
}));
vi.mock("@/lib/server/audit/audit-log", () => ({ writeAuditLog: vi.fn(async () => {}) }));

const state = vi.hoisted(() => ({ stores: new Map<string, unknown>() }));
vi.mock("@/lib/server/db/cms-store", () => ({
  createMongoStore<T>(options: { key: string; seed: () => T }) {
    const read = async (): Promise<T> => {
      if (!state.stores.has(options.key)) state.stores.set(options.key, options.seed());
      return state.stores.get(options.key) as T;
    };
    return {
      read,
      write: async (value: T) => void state.stores.set(options.key, value),
      mutate: async <R,>(mutator: (current: T) => { next: T; result: R }) => {
        const { next, result } = mutator(await read());
        state.stores.set(options.key, next);
        return result;
      },
      reset: async () => state.stores.delete(options.key),
    };
  },
}));

import { addFiles, replaceFiles } from "@/features/media/server/media.service";

const CTX = { ip: "", userAgent: "" };
const file = (id: string, updatedAt = "2026-11-01T00:00:00Z", extra: Partial<MediaFile> = {}) =>
  ({ id, name: id, url: `https://res.cloudinary.com/x/image/upload/${id}.jpg`, type: "image", mimeType: "image/jpeg", size: 1, alt: "", publicId: `cloud-${id}`, createdAt: "", updatedAt, ...extra }) as MediaFile;
const ids = (list: MediaFile[]) => list.map((f) => f.id).sort();

beforeEach(() => {
  cloudinary.deleted = [];
  state.stores.clear();
});

describe("a stale tab's save", () => {
  it("keeps the uploads it never saw", async () => {
    state.stores.set("media-files", [file("new-from-a"), file("old")]);
    const result = await replaceFiles([file("old", "2026-11-02T00:00:00Z", { alt: "cake" })], CTX);
    expect(ids(result)).toEqual(["new-from-a", "old"]);
    expect(result.find((f) => f.id === "old")?.alt).toBe("cake");
  });

  it("does not undo another tab's newer edit", async () => {
    state.stores.set("media-files", [file("x", "2026-11-02T10:00:00Z", { name: "renamed in A" })]);
    const result = await replaceFiles([file("x", "2026-11-01T00:00:00Z", { name: "old name" })], CTX);
    expect(result[0].name).toBe("renamed in A");
  });

  it("cannot bring back a file deleted elsewhere", async () => {
    state.stores.set("media-files", [file("keep"), file("bin")]);
    await replaceFiles([file("keep")], CTX, ["bin"]);
    expect(cloudinary.deleted).toEqual(["cloud-bin"]);

    const stale = await replaceFiles([file("keep"), file("bin")], CTX);
    expect(ids(stale)).toEqual(["keep"]);
    const contributor = await addFiles([file("bin")], CTX);
    expect(ids(contributor)).toEqual(["keep"]);
  });

  it("still deletes what it names, and destroys nothing it does not", async () => {
    state.stores.set("media-files", [file("a"), file("b"), file("c")]);
    const result = await replaceFiles([file("a")], CTX, ["b"]);
    expect(ids(result)).toEqual(["a", "c"]);
    expect(cloudinary.deleted).toEqual(["cloud-b"]);
  });
});
