/**
 * TWO CALLERS ASKING AT ONCE MUST COST ONE READ.
 *
 * `/admin/header` fires the site-layout read twice: the page's own form effect
 * asks at mount, and the admin layout's deferred hydration asks a beat later —
 * before the first has settled. `hasSettled()` answers for a read that has
 * FINISHED, so the second was waved straight through. Six requests for three
 * documents, measured in a browser.
 *
 * THE COST IS NOT THE THREE EXTRA REQUESTS. The loser's response landed about
 * eight seconds after it was issued, carrying a snapshot taken before that, and
 * wrote it into the cache with `persistServerHeader`. A save made inside that
 * window is silently reverted in this browser, and a remount adopts the
 * reverted copy as both the working and the saved one — which is the failure
 * `header-repository.ts` documents for a refused WRITE, arriving through a
 * duplicate READ. The only thing keeping anyone out of that window today is
 * that the screen takes twelve seconds to become usable, and that is not a
 * guard.
 *
 * And it may NOT be `hydrateOnce`: that helper records success by key, while
 * these reads never throw — `getJson` catches and returns null — so one partial
 * read would be remembered as done and the gate could never open again.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetHydrateOnce } from "@/lib/hydrate-once";

/** A read that resolves when the case says so. */
function deferred<T>() {
  let release!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

beforeEach(() => {
  resetHydrateOnce();
  vi.resetModules();
  vi.restoreAllMocks();
});

/**
 * A fresh copy of the module under test, with its three reads stubbed.
 *
 * `vi.resetModules()` per case is load-bearing: `siteLayoutHydration` is a
 * module singleton and `createHydrationGate` has no reset, so one case calling
 * `markSettled` would short-circuit the early return for every case after it.
 */
async function loadSync(reads: {
  header?: () => Promise<unknown>;
  footer?: () => Promise<unknown>;
  appearance?: () => Promise<unknown>;
}) {
  const calls = { header: 0, footer: 0, appearance: 0 };

  /*
    THE THREE READS COME FROM `site-layout-api`, not from the repositories —
    the repositories only own the `persistServer*` half. A mock of the wrong
    module leaves the real fetchers in place, and every read then answers null
    against no server at all.
  */
  const { createHydrationGate } = await import("@/lib/hydration-gate");
  const gate = createHydrationGate();
  vi.doMock("@/features/site-layout/lib/site-layout-api", () => ({
    siteLayoutHydration: gate,
    fetchHeaderSettings: async () => {
      calls.header += 1;
      return reads.header ? await reads.header() : { logoLetter: "S", nav: [] };
    },
    fetchFooterSettings: async () => {
      calls.footer += 1;
      return reads.footer ? await reads.footer() : {};
    },
    fetchAppearanceSettings: async () => {
      calls.appearance += 1;
      return reads.appearance ? await reads.appearance() : {};
    },
  }));
  vi.doMock("@/features/site-layout/lib/header-repository", () => ({
    persistServerHeader: () => undefined,
  }));
  vi.doMock("@/features/site-layout/lib/footer-repository", () => ({
    persistServerFooter: () => undefined,
  }));
  vi.doMock("@/features/site-layout/lib/appearance-repository", () => ({
    persistServerAppearance: () => undefined,
  }));

  const mod = await import("@/components/shared/site-layout-server-sync");
  /* The gate is the one this module was given, not one it re-exports. */
  return { calls, gate, ...mod };
}

describe("the site-layout read", () => {
  it("is ONE batch however many callers ask at once", async () => {
    /*
      THE case, and it has to be asked without awaiting between the two calls —
      that is exactly the shape on /admin/header, where the page's effect and
      the layout's deferred one land in different commits of the same second.
    */
    const slow = deferred<unknown>();
    const { calls, gate, ensureSiteLayoutHydrated } = await loadSync({
      header: () => slow.promise,
    });

    const first = ensureSiteLayoutHydrated();
    const second = ensureSiteLayoutHydrated();

    expect(calls.header, "the second caller started its own read").toBe(1);
    expect(calls.footer).toBe(1);
    expect(calls.appearance).toBe(1);

    slow.release({ logoLetter: "S", nav: [] });
    expect(await first).toBe(true);
    expect(await second, "the second caller got a different answer").toBe(true);
    expect(calls.header).toBe(1);
    expect(gate.hasSettled()).toBe(true);
  });

  it("and a read that failed can be tried again", async () => {
    /*
      THE REASON `hydrateOnce` COULD NOT BE REUSED. It records success by key in
      its `.then()`, and these reads resolve `null` rather than throwing — so a
      partial read would be remembered as done, the gate would stay shut for the
      life of the page, and every header, footer and appearance save would
      report "saved on this device only".
    */
    const { calls, gate, ensureSiteLayoutHydrated } = await loadSync({
      header: async () => null,
    });

    expect(await ensureSiteLayoutHydrated(), "a partial read opened the gate").toBe(false);
    expect(gate.hasSettled()).toBe(false);
    expect(calls.header).toBe(1);

    /* The same module, asked again — nothing may remember the refusal. */
    expect(calls.header).toBe(1);
    await ensureSiteLayoutHydrated();
    expect(calls.header, "a failed read was remembered and never retried").toBe(2);
  });

  it("answers instantly once it has settled, without reading again", async () => {
    const { calls, ensureSiteLayoutHydrated } = await loadSync({});

    expect(await ensureSiteLayoutHydrated()).toBe(true);
    expect(await ensureSiteLayoutHydrated()).toBe(true);
    expect(calls.header, "a settled gate read the server again").toBe(1);
  });
});

describe("the sharer itself", () => {
  it("forgets a finished read, whether it was accepted or refused", async () => {
    const { shareHydration } = await import("@/lib/hydrate-once");

    const run = vi.fn(async () => "done");
    await shareHydration("x", run);
    await shareHydration("x", run);

    expect(run, "a finished read was remembered by key").toHaveBeenCalledTimes(2);
  });

  it("keeps different keys apart", async () => {
    const { shareHydration } = await import("@/lib/hydrate-once");

    const a = deferred<string>();
    const b = deferred<string>();
    const runA = vi.fn(() => a.promise);
    const runB = vi.fn(() => b.promise);

    void shareHydration("a", runA);
    void shareHydration("a", runA);
    void shareHydration("b", runB);

    expect(runA).toHaveBeenCalledTimes(1);
    expect(runB).toHaveBeenCalledTimes(1);

    a.release("a");
    b.release("b");
  });
});
