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

import { describe, expect, it } from "vitest";

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

  it("falls back to nothing rather than to the demo palette", () => {
    // The fallback runs when the database is unreachable. Writing the demo
    // colours there would paint an outage as a deliberate rebrand.
    const chrome = code("apps/website/lib/storefront-chrome.server.ts");
    const fallback = chrome.slice(chrome.indexOf("function fallbackChrome"));
    expect(fallback.slice(0, fallback.indexOf("}\n"))).toContain("appearance: {}");
  });
});

describe("a refused save", () => {
  it("is rolled back locally, only if the cache is still ours", () => {
    const store = code("apps/admin/appearance/lib/appearance-repository.ts");

    // It persisted, repainted and notified BEFORE asking the server, and
    // nothing put it back. `ensureSiteLayoutHydrated` short-circuits once the
    // gate has settled, so the poisoned cache survived: re-read on every
    // navigation, re-applied on unmount (undoing Discard), and adopted as the
    // SAVED value on remount — at which point the screen called a palette the
    // server had rejected "Saved".
    expect(store).toContain("async function persistAndSync");
    expect(store).toMatch(/const stillOurs = localStorage\.getItem\(STORAGE_KEY\) === JSON\.stringify\(next\)/);
    expect(store).toMatch(/if \(!accepted && typeof window !== "undefined"\)/);
    // Restoring unconditionally would undo a concurrent save the server had
    // accepted — a rejected write destroying a good one.
    expect(store).toMatch(/if \(stillOurs\)/);
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
  it("only accepts values that are actually colours", () => {
    const validators = code("features/site-layout/server/site-layout.validators.ts");
    // `z.string().min(1)` accepted "red" or a whole CSS declaration, and
    // `appearanceCssVariables` drops the WHOLE palette when one field is
    // unusable — so one bad value silently reverted the shop to the stylesheet
    // defaults. Reachable through backup restore, which JSON-parses an uploaded
    // file straight into this endpoint.
    expect(validators).toMatch(/const hexColor = z/);
    expect(validators).toContain("primaryColor: hexColor");
    expect(validators).toContain("accentColor: hexColor");
    expect(validators).toContain("surfaceColor: hexColor");
    expect(validators).toMatch(/borderRadius: z\.union\(\[z\.literal\(12\), z\.literal\(16\)\]\)/);
  });

  it("records what the value used to be", () => {
    const service = code("features/site-layout/server/site-layout.service.ts");
    // A whole-value replace logged `metadata: {}`, so after a bad restore the
    // audit trail could not say what the palette had been.
    expect(service).toContain("const before = await store.read();");
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
