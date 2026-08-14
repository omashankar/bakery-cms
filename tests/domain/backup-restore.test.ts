import { readFileSync } from "node:fs";
import { join } from "node:path";
/**
 * Exporting and restoring the shop's configuration.
 *
 * A backup is trusted precisely when nobody can check it by eye — months later,
 * after something has gone wrong. So the two things that matter are that the
 * file says which slices are really the server's, and that a restore the server
 * REFUSED does not quietly survive anywhere.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildServerBackup,
  restoreBackupToServer,
  serverBackedKeys,
} from "@/apps/admin/settings/lib/backup-repository";
import { settingsHydration } from "@/features/settings/lib/settings-api";
import { catalogHydration } from "@/features/catalog/lib/catalog-api";

/** A fetch stub whose answer depends on the URL and method. */
function mockFetch(handler: (url: string, method: string) => { ok: boolean; data?: unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const answer = handler(url, method);
      return Promise.resolve({
        ok: answer.ok,
        status: answer.ok ? 200 : 500,
        json: () => Promise.resolve({ success: answer.ok, data: answer.data ?? null }),
      } as Response);
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
  settingsHydration.markSettled();
  // Opened here for the same reason as the settings gate: otherwise every
  // guarded catalog PUT waits out the full 8s deadline and the test measures
  // that deadline rather than the restore.
  catalogHydration.markSettled();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("what an exported backup claims to be", () => {
  it("names the slices it could NOT read from the server", async () => {
    // A failed read falls back to whatever this browser held — the demo seed on
    // a cold or signed-out load — and the file was still called a server
    // backup. It gets restored months later over the real thing by someone
    // with no way left to tell which slices were ever real.
    mockFetch(() => ({ ok: false }));

    const { unavailableSections } = await buildServerBackup();
    expect(unavailableSections.length).toBeGreaterThan(0);
  });

  it("reports nothing missing when every read succeeded", async () => {
    mockFetch(() => ({ ok: true, data: {} }));

    const { unavailableSections } = await buildServerBackup();
    expect(unavailableSections).toEqual([]);
  });
});

describe("restoring a backup", () => {
  /** A snapshot carrying one server-backed key and one browser-only key. */
  const snapshot: Record<string, string | null> = {
    // A real section key, so the push actually sends something: an
    // unrecognised payload is refused outright, which is what the tests below
    // check. (This comment used to say `pushSettingsSections` "returns true
    // vacuously" — that WAS the behaviour, and the record of it is how the
    // catalog twin went on doing it after the settings half was repaired.)
    [serverBackedKeys[0]]: JSON.stringify({ general: { siteName: "Restored Bakery" } }),
    "bakery-cms-products": JSON.stringify([{ id: "p1" }]),
  };

  it("does NOT leave a refused section in the local cache", async () => {
    // The old order wrote localStorage FIRST. A section the server then refused
    // sat in the cache anyway — and every form in this admin writes its whole
    // section back from that cache, so the next edit to one field carried the
    // rejected payload to the server. A restore the admin was told had failed
    // landed later, by the back door.
    mockFetch((_url, method) => ({ ok: method === "GET" }));

    const result = await restoreBackupToServer(snapshot);

    expect(result.failedSections.length).toBeGreaterThan(0);
    expect(localStorage.getItem(serverBackedKeys[0])).toBeNull();
  });

  it("writes a section locally once the server has taken it", async () => {
    mockFetch(() => ({ ok: true, data: {} }));

    const result = await restoreBackupToServer(snapshot);

    expect(result.failedSections).toEqual([]);
    expect(localStorage.getItem(serverBackedKeys[0])).toBe(snapshot[serverBackedKeys[0]]);
  });

  it("still restores browser-only slices when the server refuses everything", async () => {
    // For these the browser IS the destination — there is no whole-value
    // endpoint to refuse them, so holding them back would lose data for nothing.
    mockFetch((_url, method) => ({ ok: method === "GET" }));

    await restoreBackupToServer(snapshot);

    expect(localStorage.getItem("bakery-cms-products")).toBe(
      snapshot["bakery-cms-products"],
    );
  });
});

describe("the sections a restore can open its own gates for", () => {
  /**
   * Not every server-backed key, and the reason is itself the finding.
   *
   * This suite exercised `serverBackedKeys[0]` alone, so fifteen sections had
   * no restore coverage at all. Adding all of them showed why it mattered and
   * where the limit is: each guarded PUT waits out the full hydration deadline
   * when its gate is shut, and `restoreBackupToServer` can only open the gates
   * that expose a callable opener.
   *
   * Content, commerce and catalog open theirs from a mount effect only —
   * `content-server-sync.tsx`, `commerce-server-sync.tsx`,
   * `catalog-server-sync.tsx`. In the running admin those components are
   * mounted, so their gates are open; from here nothing can open them, and a
   * test that waited them out would be measuring the deadline rather than the
   * restore.
   *
   * So these are the sections this file can actually pin. The rest stay
   * uncovered, deliberately and on the record.
   */
  const OPENABLE = [
    "bakery-cms-settings",
    "bakery-cms-seo",
    "bakery-cms-invoice-settings",
    "bakery-cms-payment-gateways",
    "bakery-cms-payment-notif-prefs",
    "bakery-cms-admin-profile",
    "bakery-cms-custom-code",
  ].filter((key) => serverBackedKeys.includes(key));

  it("covers more than the first section, and less than all of them", () => {
    expect(OPENABLE.length).toBeGreaterThan(1);
    expect(OPENABLE.length).toBeLessThan(serverBackedKeys.length);
  });

  it.each(OPENABLE)("%s is not left in the cache when the server refuses it", async (key) => {
    mockFetch((_url, method) => ({ ok: method === "GET" }));

    const result = await restoreBackupToServer({ [key]: JSON.stringify({}) });

    // Every admin form writes its whole section back from that cache, so a
    // rejected payload left there reaches the server by the back door on the
    // next edit — a restore the admin was told had failed, landing later.
    if (result.failedSections.length > 0) {
      expect(localStorage.getItem(key)).toBeNull();
    }
  });

  it("opens the gates itself rather than trusting the caller to", () => {
    const repo = readFileSync(
      join(process.cwd(), "apps/admin/settings/lib/backup-repository.ts"),
      "utf8",
    );
    // A restore writes sixteen sections in sequence, so a shut gate costs the
    // full deadline each time and then reports the server as having refused,
    // which it never did. The backup page opened one gate at the call site;
    // doing it here means the function cannot be used wrongly.
    expect(repo).toContain("await openEveryGate();");
    for (const opener of [
      "ensureSettingsHydrated",
      "ensureSiteLayoutHydrated",
      "ensureSeoHydrated",
      "ensureAdminConfigHydrated",
      "ensureInvoiceSettingsHydrated",
    ]) {
      expect(repo, opener).toContain(opener + "(),");
    }
  });
});

/**
 * The list of rollback points is not shop data.
 *
 * `bakery-cms-backup-history` starts with `bakery-cms` like every other key, so
 * it rode along in BOTH directions. Each snapshot embedded the whole previous
 * history and the next embedded that, roughly doubling per export until
 * `localStorage.setItem` threw QuotaExceededError and export simply stopped
 * working. And a restore wrote the file's history over this machine's —
 * deleting the "Before import" snapshot the import dialog had taken seconds
 * earlier and promised the admin they could roll back to.
 */
describe("the backup history is not itself backed up", () => {
  const HISTORY = "bakery-cms-backup-history";

  it("is left out of a snapshot, so snapshots do not nest", async () => {
    localStorage.setItem(HISTORY, JSON.stringify([{ id: "old", data: {} }]));
    localStorage.setItem("bakery-cms-products", JSON.stringify([{ id: "p1" }]));
    mockFetch(() => ({ ok: true, data: {} }));

    const { data } = await buildServerBackup();

    expect(data[HISTORY]).toBeUndefined();
    // and it still carries the things that ARE shop data
    expect(data["bakery-cms-products"]).toBeDefined();
  });

  it("survives a restore that carries someone else's history", async () => {
    const mine = JSON.stringify([{ id: "before-import", label: "Before import" }]);
    localStorage.setItem(HISTORY, mine);
    mockFetch((_url, method) => ({ ok: method === "GET" || method === "PUT" }));

    await restoreBackupToServer({
      [HISTORY]: JSON.stringify([{ id: "from-the-file", label: "Someone else's machine" }]),
      "bakery-cms-products": JSON.stringify([{ id: "p1" }]),
    });

    // The one rollback point an admin needs after a bad import is the one the
    // import itself took.
    expect(localStorage.getItem(HISTORY)).toBe(mine);
    expect(localStorage.getItem("bakery-cms-products")).toBeDefined();
  });
});

/**
 * `[].every(Boolean)` is true, so a payload matching no known section reported
 * a successful push having contacted the server zero times. That was fixed for
 * settings and the comment explaining it left sitting one function above the
 * catalog twin, which went on doing it.
 */
describe("a restore does not claim sections it never sent", () => {
  it("refuses a catalog blob with nothing recognisable in it", async () => {
    let puts = 0;
    mockFetch((_url, method) => {
      if (method !== "GET") puts += 1;
      return { ok: true, data: {} };
    });

    const result = await restoreBackupToServer({
      "bakery-cms-catalog": JSON.stringify({ nothing: "recognisable" }),
    });

    expect(puts).toBe(0);
    expect(result.serverSections).not.toContain("Catalog");
    expect(result.failedSections).toContain("Catalog");
    // And above all it is not written locally: `loadCatalogStore` substitutes
    // the demo categories, flavours, occasions and weights for every section a
    // blob is missing, which the Catalog page's next save would ship to Mongo.
    expect(localStorage.getItem("bakery-cms-catalog")).toBeNull();
  });

  it("still pushes a catalog blob that has a real section in it", async () => {
    let puts = 0;
    mockFetch((_url, method) => {
      if (method !== "GET") puts += 1;
      return { ok: true, data: {} };
    });

    const result = await restoreBackupToServer({
      "bakery-cms-catalog": JSON.stringify({ categories: [{ id: "c1", name: "Cakes" }] }),
    });

    expect(puts).toBeGreaterThan(0);
    expect(result.serverSections).toContain("Catalog");
  });
});
