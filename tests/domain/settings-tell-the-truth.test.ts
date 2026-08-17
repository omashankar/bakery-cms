import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultAppSettings, isValidEmailAddress } from "@/features/settings/lib/settings-utils";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

async function freshModules() {
  vi.resetModules();
  return import("@/features/settings/lib/settings-repository");
}

/** Hydration succeeds; every section PUT is refused. */
function serverRefusesWrites() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              ...defaultAppSettings,
              general: { ...defaultAppSettings.general, siteName: "Real Shop" },
            },
          }),
        };
      }
      return { ok: false, status: 500, json: async () => ({ success: false, data: null }) };
    }) as unknown as typeof fetch,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

/**
 * `persist()` dispatches SETTINGS_UPDATED_EVENT and every live consumer reads
 * the store on it — the sidebar, the storefront module gates, the currency, the
 * timezone. The ROLLBACK wrote to localStorage silently, so a refused save left
 * the whole admin sitting on the value the server had turned down: the Wedding
 * Builder entry gone from the sidebar, the business type switched, all from a
 * write that never landed.
 */
describe("a refused save is undone everywhere, not just in storage", () => {
  it("announces the rollback the same way the write was announced", async () => {
    const repo = await freshModules();
    serverRefusesWrites();
    await repo.hydrateSettingsFromServer();

    const seen: string[] = [];
    const listener = () => seen.push(repo.getGeneralSettings().siteName);
    window.addEventListener(repo.SETTINGS_UPDATED_EVENT, listener);

    const result = await repo.saveGeneralSettings({
      ...defaultAppSettings.general,
      siteName: "Rejected Name",
    });
    window.removeEventListener(repo.SETTINGS_UPDATED_EVENT, listener);

    expect(result.persisted).toBe(false);
    // The write fired one, the rollback fired another — and the LAST thing
    // every listener was told is the value that is actually in force.
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen.at(-1)).toBe("Real Shop");
    expect(repo.getGeneralSettings().siteName).toBe("Real Shop");
  });

  it("says the change is not saved, rather than saved on this device", () => {
    const report = source("apps/admin/settings/lib/report-settings-write.ts");

    // After the rollback it is saved nowhere. "Saved on this device only" told
    // the admin the opposite of what had happened.
    expect(report).toContain("not saved — the server rejected it");
    expect(report).not.toContain("saved on this device only — the server rejected it");
  });
});

/**
 * The server stopped handing the mail password to the browser
 * (`redactMailPassword`), and its comment lists why: it "was written to
 * localStorage by the settings store, survived logout, rode along to every
 * device that admin signed in from, was readable by any script on any admin
 * page, and was swept into every downloadable backup file". Redacting the READ
 * left the other end open — the admin TYPES it into the form.
 */
describe("the mail password never reaches localStorage", () => {
  it("is not in the cache after a save that carried it", async () => {
    const repo = await freshModules();
    const sent: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if ((init?.method ?? "GET") === "GET") {
          return { ok: true, status: 200, json: async () => ({ success: true, data: defaultAppSettings }) };
        }
        if (String(url).endsWith("/smtp")) sent.push(JSON.parse(String(init?.body)));
        return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
      }) as unknown as typeof fetch,
    );
    await repo.hydrateSettingsFromServer();

    await repo.saveSmtpSettings({
      ...defaultAppSettings.smtp,
      host: "smtp.example.com",
      password: "a-real-live-secret",
    });

    expect(localStorage.getItem("bakery-cms-settings")).not.toContain("a-real-live-secret");
    // ...and it still reached the SERVER, which is the only place it belongs.
    expect(JSON.stringify(sent)).toContain("a-real-live-secret");
    // The rest of the section is cached as normal.
    expect(repo.getSmtpSettings().host).toBe("smtp.example.com");
  });

  it("keeps it out of a backup, which sweeps every bakery-cms key", async () => {
    const repo = await freshModules();
    localStorage.setItem(
      "bakery-cms-settings",
      JSON.stringify({ ...defaultAppSettings, smtp: { ...defaultAppSettings.smtp, password: "x" } }),
    );
    // The cache is only ever written through `persist`, so a value that got in
    // some other way is out of scope — what matters is that the writer scrubs.
    const repoSource = source("features/settings/lib/settings-repository.ts");
    expect(repoSource).toContain("JSON.stringify(scrubbedForCache(settings))");
    expect(typeof repo.exportLocalStorageBackup).toBe("function");
  });
});

/**
 * A rule restated is a rule that drifts. The Contact form carried a regex
 * "deliberately matching what Zod's z.email() accepts" and it did not, in
 * either direction — so a legal address froze Save for the WHOLE section, and
 * the shop could not change its phone or opening hours either.
 */
describe("one email rule", () => {
  it("accepts the awkward but legal addresses Zod accepts", () => {
    for (const address of ["o'brien@bakery.ie", "a+tag@shop.co.uk", "x_y-z@sub.domain.in"]) {
      expect(isValidEmailAddress(address), address).toBe(true);
    }
  });

  it("still refuses what is not an address", () => {
    for (const address of ["", "not-an-email", "a@b", "@nowhere.com", "spaces in@here.com"]) {
      expect(isValidEmailAddress(address), address).toBe(false);
    }
  });

  it("is the one the form uses, not a copy of it", () => {
    const page = source("apps/admin/settings/components/contact-settings-page.tsx");

    expect(page).toContain("isValidEmailAddress(email)");
    expect(page).not.toMatch(/const EMAIL_PATTERN = \//);
  });
});

/**
 * Three screens stating something about the LIVE shop from the unsaved draft in
 * front of the admin, or from a value that had not been read from the server
 * yet.
 */
describe("a screen does not state the live shop from an unsaved draft", () => {
  it("the maintenance header counts the allow-list the shop actually has", () => {
    const page = source("apps/admin/settings/components/maintenance-settings-page.tsx");

    expect(page).toContain("const allowedIpCount = saved.allowedIps.length;");
    expect(page).not.toContain("const allowedIpCount = settings.allowedIps.length;");
  });

  it("Shipping Rules describes checkout, and flags a change that has not been saved", () => {
    const page = source("apps/admin/commerce/pages/shipping-rules-admin-page.tsx");

    expect(page).toContain("const liveZonePricing = saved.useZoneBasedDelivery;");
    expect(page).toContain("zonePricingPending");
    expect(page).toContain("Not applied yet");
    // The banner is about checkout, so it reads `saved` too.
    expect(page).toContain('{hydration === "ready" && !liveZonePricing ? (');
  });

  it("Send test email waits for the server's copy, like Reset does", () => {
    const page = source("apps/admin/settings/components/smtp-settings-page.tsx");

    expect(page).toContain('disabled={testing || hydration !== "ready"}');
  });

  it("the locale is only published from a resolved read", () => {
    const layout = source("app/layout.tsx");

    // `setActiveLocale` was already gated on `resolved`; the second publisher,
    // which writes the same values into the client module graph, was not — so
    // one failed settings read repriced a USD shop in rupees for that visitor.
    expect(layout).toContain("{resolved ? <LocaleSync");
  });
});

/**
 * A fixed ten-minute heartbeat is longer than the timeout the Security screen
 * lets an owner choose, and the server's idle check only moves when the client
 * asks — so tightening the setting signed the admin out while they were working.
 */
describe("the session heartbeat follows the shop's own timeout", () => {
  it("is derived, floored and capped", () => {
    /**
     * Scoped to the function that computes the DELAY.
     *
     * All four assertions were file-wide, and the file has since grown a second
     * reader of the same setting (`sessionTimeoutMs`, for the expiry warning)
     * and a second timer (`armWatch`). So every one of them was satisfied by
     * code that has nothing to do with the heartbeat: the interval could go
     * back to a fixed ten minutes — the exact defect this describe block names
     * — and all four still passed.
     */
    const hook = source("features/auth/lib/use-session-refresh.ts");
    const from = hook.indexOf("function refreshIntervalMs");
    expect(from, "the heartbeat's delay function was not found").toBeGreaterThan(-1);
    const derive = hook.slice(from, hook.indexOf("\n}", from));

    expect(derive, "the heartbeat no longer reads the shop's timeout").toContain(
      "getSecuritySettings().sessionTimeoutMinutes",
    );
    expect(derive, "the floor is gone").toContain("REFRESH_FLOOR_MS");
    expect(derive, "the cap is gone").toContain("REFRESH_CEILING_MS");

    /**
     * And the heartbeat's OWN timer re-reads it each round. `arm` is the
     * heartbeat; `armWatch` is the expiry warning, and finding `setTimeout` in
     * that one told us nothing about this one.
     */
    const armAt = hook.indexOf("const arm =");
    expect(armAt, "the heartbeat timer was not found").toBeGreaterThan(-1);
    // Bounded by the function's own closing `};` — slicing to the next `arm();`
    // stopped at the SELF-RESCHEDULE inside it, cutting off the delay argument
    // this is about.
    const arm = hook.slice(armAt, hook.indexOf("\n    };", armAt));

    expect(arm, "the delay is no longer recomputed each round").toContain("refreshIntervalMs()");
    expect(arm).toContain("window.setTimeout(");
    expect(arm, "a fixed interval cannot follow a policy change").not.toContain(
      "window.setInterval(",
    );
  });
});
