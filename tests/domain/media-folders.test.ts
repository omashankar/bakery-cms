import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Two folders called "Cakes" are indistinguishable.
 *
 * `createMediaFolder` did no name check, and both the sidebar and the Move
 * dialog show only the name — the option's value is the id. So a second folder
 * called "Cakes" looked exactly like the built-in one, files scattered across two
 * folders the admin believed were one, and neither could be merged. Nor could the
 * duplicate be removed: `deleteMediaFolder` existed and nothing in the UI could
 * reach it, so the folder was permanent.
 */

vi.mock("./media-api", () => ({}));
vi.mock("@/apps/admin/media/lib/media-api", () => ({
  replaceMediaFoldersRequest: vi.fn(async () => true),
  replaceMediaFilesRequest: vi.fn(async () => true),
  mediaHydration: { hasSettled: () => true, markSettled: () => {}, waitForSettled: async () => true },
  fetchMediaFiles: vi.fn(async () => []),
  fetchMediaFolders: vi.fn(async () => []),
  uploadMediaRequest: vi.fn(async () => null),
}));

import {
  createMediaFolder,
  defaultMediaFolders,
  deleteMediaFolder,
  loadMediaFolders,
  mediaFolderNameTaken,
} from "@/apps/admin/media/lib/media-folders";

describe("media folders", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("ships the built-in folders to a new browser", () => {
    expect(loadMediaFolders().map((f) => f.name)).toEqual(
      defaultMediaFolders.map((f) => f.name),
    );
  });

  it("creates a folder with a new name", async () => {
    const { value } = await createMediaFolder("Seasonal");

    expect(value?.name).toBe("Seasonal");
    expect(loadMediaFolders().some((f) => f.name === "Seasonal")).toBe(true);
  });

  it("refuses a name that is already taken", async () => {
    const { value } = await createMediaFolder("Cakes");

    expect(value).toBeNull();
    expect(loadMediaFolders().filter((f) => f.name === "Cakes")).toHaveLength(1);
  });

  it("treats case and surrounding space as the same name", async () => {
    expect((await createMediaFolder("  cakes ")).value).toBeNull();
    expect((await createMediaFolder("GALLERY")).value).toBeNull();
    expect(mediaFolderNameTaken("banners & offers")).toBe(true);
  });

  it("refuses an empty name", async () => {
    expect((await createMediaFolder("   ")).value).toBeNull();
  });

  it("deletes a folder the shop created", async () => {
    const { value: folder } = await createMediaFolder("Seasonal");

    const { value: removed } = await deleteMediaFolder(folder!.id);

    expect(removed).toBe(true);
    expect(loadMediaFolders().some((f) => f.id === folder!.id)).toBe(false);
  });

  it("refuses to delete a built-in folder", async () => {
    const { value: removed } = await deleteMediaFolder(defaultMediaFolders[0].id);

    expect(removed).toBe(false);
    expect(loadMediaFolders().some((f) => f.id === defaultMediaFolders[0].id)).toBe(true);
  });

  it("frees the name again once the folder is gone", async () => {
    const { value: folder } = await createMediaFolder("Seasonal");
    await deleteMediaFolder(folder!.id);

    expect((await createMediaFolder("Seasonal")).value).not.toBeNull();
  });

  it("leaves an emptied list empty rather than re-seeding it", () => {
    localStorage.setItem("bakery-cms-media-folders", "[]");

    expect(loadMediaFolders()).toEqual([]);
  });
});
