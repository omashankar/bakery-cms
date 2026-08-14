import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MediaFile } from "@/types/media";

/**
 * Destroying a Cloudinary asset is irreversible, so it follows an explicit
 * delete — never the mere absence of a file from a replace-all.
 *
 * `replaceFiles` used to compute "removed" as everything stored with a publicId
 * that was not in the incoming list, and destroy all of it. But a replace-all is
 * what renaming a file, moving it to a folder or editing its alt text sends. Two
 * admin tabs were enough: tab A uploads three photos; tab B, hydrated before
 * those uploads, edits one alt text; B's whole stale list arrives with A's three
 * files absent, and all three are destroyed at Cloudinary. Every product, banner
 * and section pointing at them renders a broken image, with nothing to restore.
 */

const cloudinary = vi.hoisted(() => ({
  deleted: [] as string[],
  deleteFromCloudinary: vi.fn(async (publicId: string) => {
    cloudinary.deleted.push(publicId);
  }),
}));

vi.mock("@/lib/server/media/cloudinary", () => ({
  isCloudinaryConfigured: () => true,
  uploadToCloudinary: vi.fn(),
  deleteFromCloudinary: cloudinary.deleteFromCloudinary,
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
      write: async (value: T) => {
        state.stores.set(options.key, value);
      },
      mutate: async <R,>(mutator: (current: T) => { next: T; result: R }) => {
        const { next, result } = mutator(await read());
        state.stores.set(options.key, next);
        return result;
      },
      reset: async () => state.stores.delete(options.key),
    };
  },
  hasSeeded: async () => true,
  markSeeded: async () => {},
}));

import { replaceFiles } from "@/features/media/server/media.service";

const CTX = { ip: "", userAgent: "" };

function file(id: string, publicId?: string): MediaFile {
  return {
    id,
    name: id,
    url: `https://cdn.example.com/${id}.jpg`,
    type: "image",
    mimeType: "image/jpeg",
    size: 1000,
    publicId,
    createdAt: "",
    updatedAt: "",
  } as MediaFile;
}

const ORIGINAL = [file("a", "cloud-a"), file("b", "cloud-b"), file("c", "cloud-c")];

describe("saving the media library", () => {
  beforeEach(() => {
    cloudinary.deleted = [];
    state.stores.set("media-files", [...ORIGINAL]);
  });

  it("destroys nothing when a stale tab simply omits files", async () => {
    // Tab B's list predates A's uploads of b and c.
    await replaceFiles([file("a", "cloud-a")], CTX);

    expect(cloudinary.deleted).toEqual([]);
  });

  it("destroys exactly the assets the caller named as deleted", async () => {
    await replaceFiles([file("a", "cloud-a"), file("c", "cloud-c")], CTX, ["b"]);

    expect(cloudinary.deleted).toEqual(["cloud-b"]);
  });

  it("destroys nothing for a rename or an alt-text edit", async () => {
    const renamed = ORIGINAL.map((f) => (f.id === "a" ? { ...f, name: "new name" } : f));

    await replaceFiles(renamed, CTX);

    expect(cloudinary.deleted).toEqual([]);
  });

  it("will not destroy an asset that is still in the list, even if named", async () => {
    // A confused caller naming an id it also kept must not lose the asset.
    await replaceFiles([...ORIGINAL], CTX, ["b"]);

    expect(cloudinary.deleted).toEqual([]);
  });

  it("ignores a named id with no Cloudinary asset behind it", async () => {
    state.stores.set("media-files", [file("a"), file("b", "cloud-b")]);

    await replaceFiles([file("b", "cloud-b")], CTX, ["a"]);

    expect(cloudinary.deleted).toEqual([]);
  });

  it("still stores the list it was given", async () => {
    const result = await replaceFiles([file("a", "cloud-a")], CTX, ["b", "c"]);

    expect(result.map((f) => f.id)).toEqual(["a"]);
    expect(cloudinary.deleted.sort()).toEqual(["cloud-b", "cloud-c"]);
  });
});
