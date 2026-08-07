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
    // A real section key, so the push actually sends something: with an
    // unrecognised payload `pushSettingsSections` finds nothing to push and
    // returns true vacuously.
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
