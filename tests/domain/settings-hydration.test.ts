/**
 * The settings hydration gate, and the two ways it was wrong.
 *
 * A section PUT is a replace-all, so writing settings from a browser whose local
 * copy is still the demo seed overwrites the shop's real ones. The gate exists
 * to stop that. But a gate is only as good as the thing that opens it:
 *
 * 1. THE GATE HAD ONE OPENER, AND IT NEVER RAN AGAIN.
 *    `SettingsServerSync` mounts in the ROOT layout with a `[]`-dep effect. An
 *    admin signing in through the login form loads that layout while anonymous
 *    — `/api/settings` 401s, so the gate stays shut — and then reaches the admin
 *    by `router.push`, a soft navigation that never remounts the layout. The
 *    effect never ran again, so the gate stayed shut for the whole session and
 *    EVERY settings save in the app failed with "saved on this device only".
 *
 * 2. IT ONLY MAY OPEN ON A FULL READ.
 *    The public subset carries no smtp/security/analytics, so opening on it
 *    would still let those sections be pushed as this browser's seed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultAppSettings } from "@/features/settings/lib/settings-utils";

/** A fresh module graph, so the process-wide gate starts shut again. */
async function freshModules() {
  vi.resetModules();
  const api = await import("@/features/settings/lib/settings-api");
  const repo = await import("@/features/settings/lib/settings-repository");
  return { api, repo };
}

/**
 * Stands in for the server. `full` decides whether the authenticated
 * `/api/settings` read succeeds — anonymous is exactly the login-page case.
 */
function mockServer({ full, contact }: { full: boolean; contact?: Record<string, unknown> }) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";

    if (method === "GET" && url === "/api/settings") {
      if (!full) return { ok: false, status: 401, json: async () => ({ success: false, data: null }) };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { ...defaultAppSettings, contact: { ...defaultAppSettings.contact, ...contact } },
        }),
      };
    }

    if (method === "GET" && url === "/api/settings/public") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { general: defaultAppSettings.general } }),
      };
    }

    // Any section PUT.
    return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
  });

  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
}

function putsFor(fetchMock: ReturnType<typeof mockServer>, section: string) {
  return fetchMock.mock.calls.filter(
    ([url, init]) => url === `/api/settings/${section}` && init?.method === "PUT"
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("hydration before a settings write", () => {
  it("opens the gate on demand, so a save works after an in-app login", async () => {
    const { api, repo } = await freshModules();

    // The page load happened while anonymous: the root-layout sync ran, the
    // authenticated read 401'd, the gate stayed shut. That is the state the
    // admin is in immediately after signing in via the form.
    mockServer({ full: false });
    await repo.hydrateSettingsFromServer();
    expect(api.settingsHydration.hasSettled()).toBe(false);

    // They are authenticated now. Saving must not fail for the rest of the
    // session just because a mount effect will never run again.
    const fetchMock = mockServer({ full: true, contact: { phone: "+91 90000 00000" } });
    const result = await repo.saveContactSettings({
      ...defaultAppSettings.contact,
      phone: "+91 11111 11111",
    });

    expect(result.persisted).toBe(true);
    expect(api.settingsHydration.hasSettled()).toBe(true);
    expect(putsFor(fetchMock, "contact")).toHaveLength(1);
  });

  it("hydrates the OTHER sections before writing one, so they are never seeded back", async () => {
    const { repo } = await freshModules();

    // This browser has never hydrated: `loadSettings()` answers with the demo
    // seed and the shop's real details exist only on the server.
    mockServer({ full: true, contact: { address: "9 Real Street, Delhi" } });
    expect(repo.getContactSettings().address).toBe(defaultAppSettings.contact.address);

    // Writing a DIFFERENT section must pull the server's copy in first. Without
    // that, `updateStore`'s merge would persist the seed over the local store
    // and the next section write would ship it.
    await repo.saveAnalyticsSettings({ ...defaultAppSettings.analytics, hotjarId: "42" });

    expect(repo.getContactSettings().address).toBe("9 Real Street, Delhi");
  });

  it("cannot rescue a stale section the CALLER supplied — that is the form's job", async () => {
    const { repo } = await freshModules();

    // Deliberately pinned: `saveContactSettings(x)` sends `x`. Merging server
    // values back into it would silently undo an admin's intentional deletions,
    // so the protection has to be upstream — `useSettingsSection` keeps the
    // fields behind a skeleton until hydration lands, so a form can never hand
    // over a seed snapshot in the first place.
    const fetchMock = mockServer({ full: true, contact: { address: "9 Real Street, Delhi" } });

    const staleSnapshot = repo.getContactSettings();
    await repo.saveContactSettings({ ...staleSnapshot, phone: "+91 22222 22222" });

    const [, init] = putsFor(fetchMock, "contact")[0];
    const sent = JSON.parse(String(init?.body));
    expect(sent.phone).toBe("+91 22222 22222");
    expect(sent.address).toBe(defaultAppSettings.contact.address);
  });

  it("refuses the write when the server cannot be read — and fails FAST", async () => {
    const { repo } = await freshModules();

    // Not "save it anyway": the local copy is the seed, and a section PUT is a
    // replace-all. Reporting persisted:false keeps Save enabled for a retry.
    //
    // The speed is part of the contract. Letting this fall through to
    // `pushSection` meant burning the gate's 8-second timeout per section with
    // the Save button sitting enabled and unlabelled the whole time.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const started = performance.now();
    const result = await repo.saveContactSettings(defaultAppSettings.contact);

    expect(result.persisted).toBe(false);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("does not open on the public subset, which omits the secret sections", async () => {
    const { api, repo } = await freshModules();

    mockServer({ full: false });
    const opened = await repo.hydrateSettingsFromServer();

    expect(opened).toBe(false);
    expect(api.settingsHydration.hasSettled()).toBe(false);
    // The public read still populates what it can, so the storefront is right.
    expect(repo.getGeneralSettings().siteName).toBe(defaultAppSettings.general.siteName);
  });
});
