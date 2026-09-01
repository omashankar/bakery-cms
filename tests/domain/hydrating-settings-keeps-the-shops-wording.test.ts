import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The line that threw the shop's own wording away on every page load.
 *
 * `hydrateSettingsFromServer` does not merge the server's response — it rebuilds
 * the local settings object SECTION BY SECTION, by hand, naming each one. A
 * section missing from that list is silently discarded, however correctly the
 * server resolved it. `labelOverrides` was missing, so the server computed the
 * shop's wording on every request, shipped it, and the browser dropped it before
 * anything could read it.
 *
 * That is not a defect a merge test can catch: `mergeAppSettings` handles the
 * field perfectly and is called with an object that never contained it. So this
 * exercises the real hydrate against a stubbed API, which is the only place the
 * hand-written list is executed.
 *
 * In its own file because it mocks `settings-api`, and the sibling test asserts
 * on the REAL `SERVER_SECTIONS` — mocking that module there would have it
 * assert against the mock.
 */

const state = vi.hoisted(() => ({
  server: {} as Record<string, unknown>,
}));

vi.mock("@/features/settings/lib/settings-api", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    fetchFullSettings: async () => state.server,
    fetchPublicSettings: async () => state.server,
    pushSection: async () => ({ ok: true }),
    resetSectionRequest: async () => ({ ok: true }),
  };
});

const { hydrateSettingsFromServer, getLabelSettings, loadSettings } = await import(
  "@/features/settings/lib/settings-repository"
);

beforeEach(() => {
  localStorage.clear();
  state.server = {};
});

describe("hydrating from the server", () => {
  it("keeps the wording the shop configured", async () => {
    state.server = {
      general: { siteName: "Petal & Stem", businessType: "flower-shop", currency: "INR" },
      labelOverrides: { productWord: "Bouquet", productWordPlural: "Flowers" },
    };

    await hydrateSettingsFromServer();

    expect(getLabelSettings().productWord, "the hydrate dropped the section").toBe("Bouquet");
    expect(getLabelSettings().productWordPlural).toBe("Flowers");
  });

  it("does not wipe a local override when the server sends none", async () => {
    state.server = {
      general: { siteName: "Petal & Stem", businessType: "flower-shop", currency: "INR" },
      labelOverrides: { productWord: "Bouquet" },
    };
    await hydrateSettingsFromServer();

    // A later read that omits the section — the public subset, for instance.
    state.server = { general: { siteName: "Petal & Stem", currency: "INR" } };
    await hydrateSettingsFromServer();

    expect(getLabelSettings().productWord).toBe("Bouquet");
  });

  it("still carries the sections it always did", () => {
    // Guard against the fix being made by loosening the hand-written list into
    // something that quietly stops naming the others.
    const settings = loadSettings();

    expect(settings.general).toBeDefined();
    expect(settings.commerce).toBeDefined();
    expect(settings.modules).toBeDefined();
    expect(settings.labelOverrides).toBeDefined();
  });
});
