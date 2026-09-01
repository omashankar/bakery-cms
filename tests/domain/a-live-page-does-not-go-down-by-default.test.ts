import { describe, expect, it } from "vitest";

import {
  defaultAppSettings,
  defaultModuleSettings,
  newShopModuleSettings,
  planSettingsRepairs,
} from "@/features/settings/lib/settings-utils";
import { applyBusinessAttributes } from "@/components/business-blocking-script";
import { BUSINESS_BLOCKING_SCRIPT } from "@/lib/business-blocking";

/**
 * ONE constant was doing four jobs, and only one of them wanted the same answer.
 *
 * `defaultModuleSettings.weddingBuilder` was flipped true -> false so a brand-new
 * install would not ship a live Wedding Builder. That is right for a NEW SHOP and
 * wrong for the other three things the same constant is used for, each of which
 * is a fallback for "we do not know yet":
 *
 *   - Settings > Modules > "Reset defaults" writes it to the SERVER. One click by
 *     the owner of a live bakery took /store/wedding-cakes offline for everyone,
 *     redirected them out of their own builder and dropped the sitemap URL —
 *     behind a dialog that says only "Replace this section with the demo
 *     defaults". Before the flip, the same click turned Wedding ON.
 *   - The client's default on a COLD BROWSER. `loadSettings` persists it, and the
 *     pre-paint script reads it, so a first visit, a private window or cleared
 *     storage hid the wedding nav item, the mobile nav, the footer link, the FAQ
 *     entry and the search result before paint — then the homepage section
 *     unmounted at hydration and came back only when the settings fetch landed.
 *   - `getServerModules`' catch. A Mongo outage 404'd a revenue page that had
 *     served through the same outage the day before.
 *
 * The rule these pin: a fallback fails OPEN — it may not take down something a
 * running shop already has. Only the one path that genuinely creates a new shop
 * starts Wedding off.
 */

describe("the fallback direction", () => {
  it("assumes wedding is ON when the stored value is unknown", () => {
    // Read by: the client's cold-browser default, mergeAppSettings, the reset
    // defaults, and the server's DB-failure catch. Every one of them is a guess,
    // and a guess must not switch off a page a shop is already selling from.
    expect(defaultModuleSettings.weddingBuilder).toBe(true);
  });

  it("starts a brand-new shop with wedding OFF", () => {
    // The one place that is not a guess. A shop that has never existed has not
    // asked for a Wedding Builder, and this is what the enum used to say.
    expect(newShopModuleSettings.weddingBuilder).toBe(false);
  });

  it("differs from the fallbacks in that one field and no other", () => {
    // A second constant is only worth having if it is narrow. Anything else that
    // drifts between them is a bug in one of the two.
    const drifted = (Object.keys(defaultModuleSettings) as (keyof typeof defaultModuleSettings)[])
      .filter((key) => defaultModuleSettings[key] !== newShopModuleSettings[key]);

    expect(drifted).toEqual(["weddingBuilder"]);
  });
});

describe("the pre-paint script", () => {
  /**
   * RUN the script, do not read it.
   *
   * This asserted `toContain("m.weddingBuilder!==false")` and
   * `not.toContain("m.weddingBuilder===true")`, which is a check on the
   * comparison operator and not on which branch stamps the attribute. Swapping
   * the arms — `m.weddingBuilder!==false?set("data-wed"):off("data-wed")` —
   * hides the wedding nav, footer link, FAQ entry and search result from every
   * cold browser, which is the regression this describes, and BOTH assertions
   * still passed. It could not fail for the bug it names.
   *
   * There is no other guard on this string in the suite, so it evaluates it in
   * the DOM and asserts the attribute the CSS actually reads.
   */
  function seed(modules?: Record<string, unknown>) {
    for (const attribute of document.documentElement.getAttributeNames()) {
      document.documentElement.removeAttribute(attribute);
    }
    localStorage.clear();
    // A REAL persisted blob. `parseSettings` drops one with no
    // `general.siteName` and hands back the all-on defaults, so seeding bare
    // modules would compare the script against a fallback, not against the twin.
    if (modules) {
      localStorage.setItem(
        "bakery-cms-settings",
        JSON.stringify({ ...defaultAppSettings, modules }),
      );
    }
  }

  function stamp(modules?: Record<string, unknown>) {
    seed(modules);
    new Function(BUSINESS_BLOCKING_SCRIPT)();
    return document.documentElement;
  }

  it("shows wedding to a browser that has never been here", () => {
    // `data-wed="0"` is what globals.css hides `[data-gate-wedding]` on. An
    // empty localStorage is the ordinary case — first visit, private window,
    // cleared site data — not the edge one.
    expect(stamp().hasAttribute("data-wed")).toBe(false);
  });

  it("hides wedding only once the shop has actually switched it off", () => {
    expect(stamp({ weddingBuilder: false }).getAttribute("data-wed")).toBe("0");
    expect(stamp({ weddingBuilder: true }).hasAttribute("data-wed")).toBe(false);
  });

  it("agrees with the hydrated twin that owns the same attribute", () => {
    // lib/business-blocking.ts says "keep the two in sync" and nothing checked
    // that they were. The twin re-stamps every one of these after hydration, so
    // a disagreement is a flash on every load of an affected shop.
    for (const modules of [
      undefined,
      { weddingBuilder: false },
      { weddingBuilder: true },
      // Neither one. The two disagreed here: `0 !== false` shows, truthiness hides.
      { weddingBuilder: 0 },
    ]) {
      const fromScript = stamp(modules).getAttribute("data-wed");
      applyBusinessAttributes();
      expect(document.documentElement.getAttribute("data-wed"), JSON.stringify(modules)).toBe(
        fromScript,
      );
    }
  });

  it("still hides the five module pickers only when explicitly switched off", () => {
    // The other five gates were always fail-open and must stay that way.
    for (const key of ["flavour", "eggEggless", "weight", "shape", "photoCake"]) {
      expect(BUSINESS_BLOCKING_SCRIPT).toContain(`m.${key}===false`);
    }
  });
});

describe("the wording a shop was already showing survives the presets being deleted", () => {
  it("backfills labelOverrides from a legacy businessType", () => {
    /**
     * `BUSINESS_LABELS` held ten trade presets and this shop's document says
     * `businessType: "bakery"`, so its admin read "Cakes" and its storefront
     * "Browse premium cakes by category, flavour, and occasion." Deleting the
     * presets with nothing written in their place changes that copy on merge
     * day, with no announcement — and `collectionsTitle`/`collectionsSubtitle`
     * have no input in the admin, so two of the four could not be typed back.
     */
    const repairs = planSettingsRepairs({
      general: { businessType: "bakery" },
      labelOverrides: undefined,
    });

    const write = repairs.find((repair) => repair.path === "labelOverrides");
    expect(write, "nothing preserved the wording the shop was showing").toBeDefined();
    expect(write?.value).toMatchObject({
      productWord: "Cake",
      productWordPlural: "Cakes",
      collectionsTitle: "Our Collections",
      collectionsSubtitle: "Browse premium cakes by category, flavour, and occasion.",
    });
  });

  it("uses the wording that business type actually had, not the bakery's", () => {
    const repairs = planSettingsRepairs({
      general: { businessType: "flower-shop" },
      labelOverrides: undefined,
    });

    expect(repairs.find((r) => r.path === "labelOverrides")?.value).toMatchObject({
      productWord: "Bouquet",
      productWordPlural: "Flowers",
    });
  });

  it("never overwrites wording the shop has already chosen", () => {
    const repairs = planSettingsRepairs({
      general: { businessType: "bakery" },
      labelOverrides: { productWord: "Gateau" },
    });

    expect(repairs.find((r) => r.path === "labelOverrides")).toBeUndefined();
  });

  it("writes nothing for a shop that never had a business type", () => {
    // A shop created after the enum was deleted has nothing to preserve, and a
    // migration that fires on every read would churn the document forever.
    expect(planSettingsRepairs({ labelOverrides: undefined })).toEqual([]);
    expect(planSettingsRepairs({ general: {}, labelOverrides: undefined })).toEqual([]);
  });
});
