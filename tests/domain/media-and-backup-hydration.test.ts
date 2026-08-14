import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/**
 * Every media mutator read `loadMediaFiles()` SYNCHRONOUSLY and only then
 * awaited. The gate lives inside `replaceMediaFilesRequest`, which holds the
 * REQUEST — but it was handed a body that had already been composed.
 *
 * And `loadMediaFiles` SEEDS when the key is absent, which on a first admin
 * visit it is: roughly forty demo records, one per URL in `collectSeedUrls()`.
 * So an upload in the first second of a page load composed
 * `[created, ...demoSeed]`, the sync settled the gate a moment later, the queued
 * PUT was released, and `replaceFiles` wrote it whole over the shop's real
 * library — with that request's `deletedIds` authorising Cloudinary deletions.
 *
 * `readHydratedCoupons` was written for exactly this, in a file whose comment
 * says it plainly: the gate has to guard the READ, not the write.
 */
const api = vi.hoisted(() => ({
  mediaHydration: { waitForSettled: vi.fn(async () => false), markSettled: vi.fn(), hasSettled: vi.fn(() => false) },
  replaceMediaFilesRequest: vi.fn(async () => true),
}));

vi.mock("@/apps/admin/media/lib/media-api", () => api);

const repo = await import("@/apps/admin/media/lib/media-repository");

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  api.mediaHydration.waitForSettled.mockResolvedValue(false);
});
afterEach(() => vi.clearAllMocks());

describe("a media mutation before the server's copy has landed", () => {
  const file = {
    name: "cake.jpg",
    url: "https://images.example/cake.jpg",
    type: "image" as const,
    mimeType: "image/jpeg",
    size: 1000,
    alt: "",
    caption: "",
    tags: [],
    width: 800,
    height: 800,
  };

  it("sends nothing at all", async () => {
    const result = await repo.addMediaFile(file);

    expect(result.persisted).toBe(false);
    expect(api.replaceMediaFilesRequest).not.toHaveBeenCalled();
  });

  it("refuses a delete rather than authorising Cloudinary removals from a seed", async () => {
    const result = await repo.deleteMediaFiles(["media-seed-1"]);

    expect(result).toEqual({ value: 0, persisted: false });
    expect(api.replaceMediaFilesRequest).not.toHaveBeenCalled();
  });

  it("refuses an update and a bulk move too", async () => {
    await expect(repo.updateMediaFile("media-seed-1", { alt: "x" })).resolves.toEqual({
      value: null,
      persisted: false,
    });
    await expect(repo.bulkMoveMediaToFolder(["media-seed-1"], "folder-uploads")).resolves.toEqual({
      value: 0,
      persisted: false,
    });
    // Reports its OWN write now: the folder sidebar used to announce "3 files
    // moved to Uploads" off the FOLDER write's success while this one had been
    // refused, leaving the files in a folder that no longer exists.
    await expect(
      repo.moveFilesToFolder("folder-cakes", "folder-uploads"),
    ).resolves.toEqual({ value: 0, persisted: false });

    expect(api.replaceMediaFilesRequest).not.toHaveBeenCalled();
  });

  it("sends once the gate has opened", async () => {
    api.mediaHydration.waitForSettled.mockResolvedValue(true);
    localStorage.setItem("bakery-cms-media-library", JSON.stringify([]));

    const result = await repo.addMediaFile(file);

    expect(result.persisted).toBe(true);
    expect(api.replaceMediaFilesRequest).toHaveBeenCalledOnce();
    const [sent] = api.replaceMediaFilesRequest.mock.calls[0] as unknown as [unknown[]];
    // The shop's real library was empty; only the new file goes up.
    expect(sent).toHaveLength(1);
  });
});

describe("the folder sidebar after hydration", () => {
  it("is told when the server's folders land", () => {
    const folders = source("apps/admin/media/lib/media-folders.ts");

    // It wrote silently and relied on `persistServerMedia` dispatching
    // afterwards — so the page's refresh() re-read folders BEFORE they were
    // written, and nothing ever re-read them again.
    expect(folders).toContain("persistServerMediaFolders");
    expect(folders).toContain("window.dispatchEvent(new Event(MEDIA_UPDATED_EVENT))");
  });

  it("writes folders before files, so the one event covers both", () => {
    const sync = source("apps/admin/media/lib/use-media-server-sync.ts");
    const folders = sync.indexOf("persistServerMediaFolders(folders)");
    const files = sync.indexOf("persistServerMedia(files)");

    expect(folders).toBeGreaterThan(-1);
    expect(folders).toBeLessThan(files);
  });
});

/**
 * `exportLocalStorageBackup()` copies every `bakery-cms*` key, so the template
 * collections were IN the file — and they were not in `SERVER_BACKUP_SECTIONS`,
 * so a restore dropped them into the browser-only bucket and wrote them straight
 * to localStorage, pushing nothing. That reopens the back door this file exists
 * to close: the templates screen composes its next save from that cache, so the
 * first unrelated edit shipped the whole restored set to Mongo.
 */
describe("what a backup restores through the server", () => {
  it("includes both template collections", () => {
    const backup = source("apps/admin/settings/lib/backup-repository.ts");

    expect(backup).toContain('key: "bakery-cms-email-templates"');
    expect(backup).toContain('key: "bakery-cms-whatsapp-templates"');
  });

  it("pushes them as a RESTORE, so a template the backup lacks is removed", () => {
    const backup = source("apps/admin/settings/lib/backup-repository.ts");
    const api = source("apps/admin/communications/lib/communications-api.ts");

    // A bare replace sends no knownIds and deletes nothing, leaving the shop
    // sending wording it believed it had replaced.
    expect(backup).toContain("replacer(restoreEmailTemplatesRequest)");
    expect(backup).toContain("replacer(restoreWhatsAppTemplatesRequest)");
    expect(api).toContain("const current = await fetchEmailTemplates();");
    expect(api).toContain("if (current === null) return false;");
  });

  it("opens their gates, or every push waits out its deadline and blames the server", () => {
    const backup = source("apps/admin/settings/lib/backup-repository.ts");
    const opener = backup.slice(backup.indexOf("async function openEveryGate"));

    expect(opener.slice(0, opener.indexOf("\n}"))).toContain("ensureCommunicationsHydrated()");
  });
});
