/**
 * The Appearance screen: what the shop picks, and whether the customer sees it.
 *
 * The seed-clobber class was already fixed here — the gate guards the read that
 * composes the payload, hydration is tri-state, reset goes through the same
 * guarded path. What an audit found instead was the two halves either side of
 * that: a rejected write that repainted anyway with nothing to undo it, and a
 * palette that never reached the customer's first paint.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  document.documentElement.style.removeProperty("--brand-primary");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock("@/features/settings/server/settings.service");
  vi.doUnmock("@/features/site-layout/server/site-layout.service");
});

import {
  appearanceCssVariables,
  defaultAppearanceSettings,
} from "@/features/site-layout/lib/appearance-tokens";
import type { AppearanceSettings } from "@/types/appearance";

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

/** The file with comments stripped — a comment quoting the old string is not the code. */
function code(relativePath: string): string {
  return source(relativePath)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const CUSTOM: AppearanceSettings = {
  ...defaultAppearanceSettings,
  primaryColor: "#123456",
  accentColor: "#abcdef",
  surfaceColor: "#fefefe",
  borderRadius: 16,
  preset: "custom",
};

describe("the palette as data", () => {
  it("produces the tokens the stylesheet reads", () => {
    const vars = appearanceCssVariables(CUSTOM);

    expect(vars["--brand-primary"]).toBe("#123456");
    expect(vars["--bakery-700"]).toBe("#123456");
    expect(vars["--brand-accent"]).toBe("#abcdef");
    expect(vars["--cream-100"]).toBe("#fefefe");
    expect(vars["--radius"]).toBe("16px");
    // Semantics by default, so a light surface gets the full palette.
    expect(vars["--primary"]).toBe("#123456");
  });

  it("omits the semantic tokens when asked to", () => {
    // Admin dark mode must not receive cream/primary overrides.
    const vars = appearanceCssVariables(CUSTOM, { forceSemantics: false });

    expect(vars["--brand-primary"]).toBe("#123456");
    expect(vars["--primary"]).toBeUndefined();
    expect(vars["--muted"]).toBeUndefined();
  });

  it("returns nothing at all for a palette it cannot use", () => {
    // Half a palette is worse than none: the stylesheet defaults are coherent,
    // a mixture of stored and default colours is not.
    expect(appearanceCssVariables({ ...CUSTOM, primaryColor: "not-a-colour" })).toEqual({});
    expect(appearanceCssVariables({ ...CUSTOM, accentColor: "" })).toEqual({});
  });

  it("is the single source both the server and the browser use", () => {
    // Two copies of this arithmetic is how a server-rendered palette and a
    // client-applied one drift into disagreeing — a flash again, just subtler.
    const utils = code("apps/admin/appearance/lib/appearance-utils.ts");
    expect(utils).toMatch(/appearanceCssVariables\(settings, options\)/);
    // The DOM applier iterates the map rather than repeating setProperty calls.
    expect(utils).not.toMatch(/el\.style\.setProperty\("--brand-primary"/);

    const chrome = code("apps/website/lib/storefront-chrome.server.ts");
    expect(chrome).toContain("appearanceCssVariables(");
  });
});

describe("the customer's first paint", () => {
  it("reads the palette on the server", () => {
    // Nothing did. `getSiteLayout("appearance")` had no caller outside the API,
    // so every visitor was painted the hardcoded defaults from globals.css —
    // byte-identical to the demo preset — until a client fetch repainted. A
    // shop on defaults never noticed; a shop with its own colours flashed demo
    // brown on every cold load.
    const chrome = code("apps/website/lib/storefront-chrome.server.ts");
    expect(chrome).toContain('getSiteLayout("appearance")');
  });

  it("writes it into the storefront shell", () => {
    const layout = code("layouts/storefront-layout.tsx");
    expect(layout).toContain("...chrome.appearance");
    // Spread AFTER colorScheme, so an empty map leaves the stylesheet standing
    // rather than blanking the scheme.
    expect(layout).toMatch(/colorScheme: "light",\s*\.\.\.chrome\.appearance/);
  });

  it("carries the STORED palette, not the default one", async () => {
    // The source-grep version of this could not tell the two branches apart:
    // it sliced on `indexOf("}\n")`, which is -1 in a CRLF file, so it
    // searched the whole file and passed with fallbackChrome and
    // getStorefrontChrome swapped. This calls the function.
    vi.doMock("@/features/settings/server/settings.service", () => ({
      getSettings: async () => ({ general: {}, contact: {}, social: [] }),
    }));
    vi.doMock("@/features/site-layout/server/site-layout.service", () => ({
      getSiteLayout: async (key: string) =>
        key === "appearance"
          ? { primaryColor: "#123456", accentColor: "#abcdef", surfaceColor: "#fefefe", borderRadius: 16, preset: "custom" }
          : {},
    }));

    const { getStorefrontChrome } = await import(
      "@/apps/website/lib/storefront-chrome.server"
    );
    const chrome = await getStorefrontChrome();

    expect(chrome.appearance["--brand-primary"]).toBe("#123456");
    expect(chrome.appearance["--radius"]).toBe("16px");
  });

  it("renders nothing rather than the demo palette when the read fails", async () => {
    // An outage must not be painted as a deliberate rebrand.
    vi.doMock("@/features/settings/server/settings.service", () => ({
      getSettings: async () => { throw new Error("mongo down"); },
    }));
    vi.doMock("@/features/site-layout/server/site-layout.service", () => ({
      getSiteLayout: async () => { throw new Error("mongo down"); },
    }));

    const { getStorefrontChrome } = await import(
      "@/apps/website/lib/storefront-chrome.server"
    );
    const chrome = await getStorefrontChrome();

    expect(chrome.appearance).toEqual({});
  });
});

describe("a refused save", () => {
  it("puts the shop's palette back in the cache and on the page", async () => {
    // Greps could spell the rollback without ever entering it: replacing the
    // body with a plain re-persist of the rejected palette passed 850 tests.
    const { saveAppearanceSettings, APPEARANCE_STORAGE_KEY } = await import(
      "@/apps/admin/appearance/lib/appearance-repository"
    );
    const { siteLayoutHydration } = await import("@/features/site-layout/lib/site-layout-api");
    siteLayoutHydration.markSettled();

    const real = { ...defaultAppearanceSettings, primaryColor: "#111111" };
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(real));

    // The server refuses.
    vi.stubGlobal("fetch", async () => new Response(null, { status: 401 }));

    const result = await saveAppearanceSettings({
      ...defaultAppearanceSettings,
      primaryColor: "#999999",
    });

    expect(result.persisted).toBe(false);
    // The cache holds the shop's palette again, not the rejected one.
    const cached = JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? "{}");
    expect(cached.primaryColor).toBe("#111111");
    // And so does the page.
    expect(
      document.documentElement.style.getPropertyValue("--brand-primary"),
    ).toBe("#111111");
  });

  it("leaves a concurrent save that the server DID accept alone", async () => {
    // Restoring the entry snapshot unconditionally would undo a good write.
    const { saveAppearanceSettings, APPEARANCE_STORAGE_KEY } = await import(
      "@/apps/admin/appearance/lib/appearance-repository"
    );
    const { siteLayoutHydration } = await import("@/features/site-layout/lib/site-layout-api");
    siteLayoutHydration.markSettled();

    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ ...defaultAppearanceSettings, primaryColor: "#111111" }));

    // While this save is in flight, another one lands and is accepted.
    vi.stubGlobal("fetch", async () => {
      localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ ...defaultAppearanceSettings, primaryColor: "#222222" }));
      return new Response(null, { status: 401 });
    });

    await saveAppearanceSettings({ ...defaultAppearanceSettings, primaryColor: "#999999" });

    const cached = JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? "{}");
    // The concurrent write survives — the refusal did not destroy it.
    expect(cached.primaryColor).toBe("#222222");
  });

  it("hands the form back what is actually in place, not what was attempted", async () => {
    // The regression this pass found. `runWrite` commits `current: value`
    // unconditionally, so returning the defaults regardless left every colour
    // field reading demo brown under a toast saying "nothing was changed" —
    // with Save enabled over the shop's real palette.
    const { resetAppearanceSettings, APPEARANCE_STORAGE_KEY } = await import(
      "@/apps/admin/appearance/lib/appearance-repository"
    );
    const { siteLayoutHydration } = await import("@/features/site-layout/lib/site-layout-api");
    siteLayoutHydration.markSettled();

    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ ...defaultAppearanceSettings, primaryColor: "#111111" }));
    vi.stubGlobal("fetch", async () => new Response(null, { status: 401 }));

    const result = await resetAppearanceSettings();

    expect(result.persisted).toBe(false);
    expect(result.value.primaryColor).toBe("#111111");
  });

  it("routes reset through the same path", () => {
    const store = code("apps/admin/appearance/lib/appearance-repository.ts");
    const reset = store.slice(store.indexOf("export async function resetAppearanceSettings"));
    // Reset wiped the cache to demo defaults and repainted before asking. A
    // refusal left the admin looking at the demo palette with their real one
    // gone from this browser — the most destructive action with no way back.
    expect(reset).toContain("persistAndSync(defaultAppearanceSettings)");
    expect(reset).not.toContain("localStorage.removeItem");
  });

  it("is reported as not saved, not as saved-on-this-device", () => {
    const page = code("apps/admin/appearance/components/appearance-page.tsx");
    // "Saved on this device only" is the default failure copy and it is wrong
    // when the store rolls back: the change is nowhere.
    expect(page).toContain("Appearance was not saved — the server rejected it");
    expect(page).toContain("Appearance was not reset — the server rejected it");
  });
});

describe("what this screen claims", () => {
  it("does not call an unconfirmed palette Saved", () => {
    const preview = code("apps/admin/appearance/components/appearance-preview.tsx");
    // On a failed read the form holds the demo seed and `isDirty` is false, so
    // an outline "Saved" badge sat inches below a notice saying the settings
    // could not be loaded.
    expect(preview).toMatch(/hydration !== "ready" \? \(/);
    expect(preview).toContain("Not loaded");
  });

  it("shows the shop its OWN name and currency", () => {
    const preview = code("apps/admin/appearance/components/appearance-preview.tsx");
    // "M" / "Monginis" / "₹1,299" — another shop's identity, in the one panel
    // whose whole job is to show this shop its storefront.
    expect(preview).not.toContain("Monginis");
    expect(preview).not.toContain("₹1,299");
    expect(preview).toContain("{siteName}");
    expect(preview).toContain("{logoLetter}");
    expect(preview).toContain("formatCurrency(1299");
  });

  it("keeps the last valid palette while a colour is mid-typing", () => {
    const preview = code("apps/admin/appearance/components/appearance-preview.tsx");
    // Falling back to the demo defaults meant deleting one character from
    // "#6f4e37" flipped the preview to demo brown while the admin chrome around
    // it kept the last valid palette — two panels disagreeing about one shop.
    expect(preview).toContain("const base = saved ?? defaultAppearanceSettings;");
    expect(preview).toMatch(/previewColor\(settings\.primaryColor, base\.primaryColor\)/);
  });

  it("says nothing about fonts, because there is no font control", () => {
    const overview = code("apps/admin/settings/components/settings-overview-page.tsx");
    const appearanceRow = overview.slice(
      overview.indexOf('title: "Appearance"'),
      overview.indexOf('title: "Appearance"') + 300,
    );
    expect(appearanceRow).not.toContain("fonts");
  });

  it("says why Reset did nothing, instead of nothing", () => {
    const page = code("apps/admin/appearance/components/appearance-page.tsx");
    // The Reset button sits in the page header, outside the gated form, so it
    // is reachable before hydration. It returned in silence: the admin
    // confirmed a destructive dialog, it closed, and nothing happened.
    expect(page).toContain("Saved appearance hasn't loaded yet");
    expect(page).not.toMatch(/async function handleReset\(\) \{\s*if \(!canSave\) return;/);
  });
});

describe("the server side", () => {
  it("only accepts values that are actually colours", async () => {
    // The grep version matched the DECLARATION, so `const hexColor =
    // z.string();` — the exact hole this closed — kept it green. Parse instead.
    const { siteLayoutSchemas } = await import(
      "@/features/site-layout/server/site-layout.validators"
    );
    const schema = siteLayoutSchemas.appearance;

    const good = {
      primaryColor: "#6f4e37",
      accentColor: "#d4a373",
      surfaceColor: "#faf8f4",
      borderRadius: 12,
    };
    expect(schema.safeParse(good).success).toBe(true);

    // One bad value drops the WHOLE palette at render time, so the shop
    // silently reverts to the stylesheet defaults. Reachable through backup
    // restore, which parses an uploaded file straight into this endpoint.
    for (const field of ["primaryColor", "accentColor", "surfaceColor"]) {
      for (const bad of ["red", "", "#ggg", "#6f4e37; background:url(x)"]) {
        expect(
          schema.safeParse({ ...good, [field]: bad }).success,
          `${field} accepted ${JSON.stringify(bad)}`,
        ).toBe(false);
      }
    }

    // The editor offers exactly two radii.
    expect(schema.safeParse({ ...good, borderRadius: 16 }).success).toBe(true);
    expect(schema.safeParse({ ...good, borderRadius: 20 }).success).toBe(false);
  });

  it("records what the value used to be", () => {
    const service = code("features/site-layout/server/site-layout.service.ts");
    // A whole-value replace logged `metadata: {}`, so after a bad restore the
    // audit trail could not say what the palette had been.
    // The ORDER is the whole point: moving the read below the write logs the
    // new value as `before`, which is worse than logging nothing.
    expect(service).toMatch(
      /const before = await store\.read\(\);[\s\S]{0,120}await store\.write\(/,
    );
    expect(service).toContain("metadata: { before, after: value }");
  });

  it("opens the gates before a restore instead of waiting each one out", () => {
    const page = code("apps/admin/settings/components/backup-settings-page.tsx");
    // Every guarded PUT waits out the full hydration deadline when its gate is
    // shut, sequentially — so a restore from a tab that never hydrated took
    // minutes and then blamed the server.
    expect(page).toMatch(
      /await ensureSiteLayoutHydrated\(\);\s*\r?\n\s*const result = await restoreBackupToServer/,
    );
  });
});

describe("everything that escapes the shell", () => {
  it("gets the palette on :root as well, from the server", () => {
    // The shell's inline style covers its own subtree and nothing else.
    // Sonner's toaster and every Base UI popup render through a PORTAL on
    // document.body, so they read the tokens from :root — which only the
    // client wrote. Those surfaces painted the stylesheet defaults until a
    // fetch landed, and for the whole session if it failed.
    const layout = code("layouts/storefront-layout.tsx");
    expect(layout).toContain("<AppearanceStyleTag tokens={chrome.appearance} />");

    const tag = code("components/shared/appearance-style-tag.tsx");
    expect(tag).toContain(":root{");
    // Nothing at all for an empty palette, so the stylesheet defaults stand.
    expect(tag).toMatch(/if \(!entries\.length\) return null;/);
  });

  it("covers the maintenance screen and the 404, which render outside it", () => {
    // The maintenance screen IS the storefront while the shop is closed.
    for (const layout of ["app/(storefront)/layout.tsx", "app/account/layout.tsx"]) {
      const rendered = code(layout);
      expect(rendered).toMatch(/<AppearanceStyleTag tokens=\{chrome\.appearance\} \/>/);
      expect(rendered).toMatch(/\.\.\.chrome\.appearance/);
    }

    const notFound = code("app/not-found.tsx");
    expect(notFound).toContain("await getStorefrontChrome()");
    expect(notFound).toContain("...chrome.appearance");
  });

  it("does not let a cold cache repaint over correct server values", () => {
    // `loadAppearanceSettings()` answers with the DEFAULTS when localStorage is
    // empty — which is every first-time visitor. Applying that over a
    // server-painted page turns a flash of the default palette into a flash of
    // the WRONG one, which is strictly worse than the bug being fixed.
    const sync = code("components/shared/appearance-theme-sync.tsx");
    expect(sync).toContain("serverAlreadyPainted()");
    expect(sync).toMatch(
      /if \(!fromCache && serverAlreadyPainted\(\) && !siteLayoutHydration\.hasSettled\(\)\)/,
    );
    // The theme CLASS is unrelated to the palette and must still be applied.
    expect(sync).toMatch(/if \(lightLocked\) applyThemeToDocument\("light"\);/);
    // Cache-backed callers pass true: by then there is a real palette.
    expect(sync).toMatch(/onAppearanceUpdated\(\) \{\s*\r?\n\s*sync\(true\);/);
  });
});
