import { describe, expect, it } from "vitest";

import {
  defaultModuleSettings,
  newShopModuleSettings,
  planSettingsRepairs,
} from "@/features/settings/lib/settings-utils";
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
  it("shows wedding unless the shop has switched it off", () => {
    /**
     * The bias, in one character. `!== false` means an absent value SHOWS;
     * `=== true` means an absent value HIDES — and absent is exactly what a
     * first-time visitor's localStorage holds.
     *
     * Asserted on the emitted script because that string is what runs before
     * paint; there is no other guard on it anywhere in the suite.
     */
    expect(BUSINESS_BLOCKING_SCRIPT).toContain("m.weddingBuilder!==false");
    expect(BUSINESS_BLOCKING_SCRIPT).not.toContain("m.weddingBuilder===true");
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
