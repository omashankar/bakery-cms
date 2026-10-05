import { describe, expect, it } from "vitest";

import {
  defaultAppSettings,
  defaultModuleSettings,
  newShopModuleSettings,
  planSettingsRepairs,
} from "@/features/settings/lib/settings-utils";
import { resolveLabels } from "@/config/business-labels";
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
  it("starts a new shop with exactly what the fallbacks say, for now", () => {
    /**
     * The two constants differed in one field: `weddingBuilder`, off for a
     * shop that had never existed and on everywhere else. That module is
     * gone, so they are identical today — and that is worth pinning rather
     * than deleting, because the pair exists for the NEXT optional feature
     * that should not be live on a fresh install. Anything that drifts
     * between them without being put there on purpose is a bug in one.
     */
    const drifted = (Object.keys(defaultModuleSettings) as (keyof typeof defaultModuleSettings)[])
      .filter((key) => defaultModuleSettings[key] !== newShopModuleSettings[key]);

    expect(drifted).toEqual([]);
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

  it("shows a gated picker to a browser that has never been here", () => {
    // `data-mod-photo="0"` is what globals.css hides `[data-gate-photo]` on.
    // An empty localStorage is the ordinary case — first visit, private
    // window, cleared site data — not the edge one.
    expect(stamp().hasAttribute("data-mod-photo")).toBe(false);
  });

  it("hides it only once the shop has actually switched it off", () => {
    expect(stamp({ photoCake: false }).getAttribute("data-mod-photo")).toBe("0");
    expect(stamp({ photoCake: true }).hasAttribute("data-mod-photo")).toBe(false);
  });

  it("agrees with the hydrated twin that owns the same attribute", () => {
    // lib/business-blocking.ts says "keep the two in sync" and nothing checked
    // that they were. The twin re-stamps every one of these after hydration, so
    // a disagreement is a flash on every load of an affected shop.
    /*
      This watched `data-wed`, which the Wedding module stamped. That module
      is gone; every other flag is stamped by the same two code paths and
      can disagree the same way, so the case moves rather than going.
    */
    for (const modules of [
      undefined,
      { photoCake: false },
      { photoCake: true },
      // Neither one. The two disagreed here: `0 !== false` shows, truthiness hides.
      { photoCake: 0 },
    ]) {
      const fromScript = stamp(modules).getAttribute("data-mod-photo");
      applyBusinessAttributes();
      expect(
        document.documentElement.getAttribute("data-mod-photo"),
        JSON.stringify(modules),
      ).toBe(fromScript);
    }
  });

  it("still hides the module pickers only when explicitly switched off", () => {
    // These gates were always fail-open and must stay that way. There were
    // five; `eggEggless` went with the egg special case.
    for (const key of ["flavour", "weight", "shape", "photoCake"]) {
      expect(BUSINESS_BLOCKING_SCRIPT).toContain(`m.${key}===false`);
    }
  });
});

describe("a shop keeps the wording its trade gave it", () => {
  /**
   * THIS BLOCK HAS NOW PINNED THREE DIFFERENT MECHANISMS FOR ONE PROPERTY.
   *
   * First a MIGRATION: when the business-type enum was deleted, a repair read
   * the stored `general.businessType`, copied that trade's wording into
   * `labelOverrides` and dropped the field — so a bakery kept reading "Cakes"
   * on merge day rather than silently becoming "Products".
   *
   * Then a LAYER: the field came back as a live setting, the repair had to go
   * (running on the singleton read, it deleted the owner's choice moments
   * after they made it), and `resolveLabels` layered the trade's preset under
   * whatever the shop had typed.
   *
   * Now NEITHER. The shop that owns this deployment asked for the control to
   * go: it gated nothing, and a dropdown labelled "What kind of shop is
   * this?" reads as configuration while all it did was pre-fill four boxes.
   *
   * THE PROPERTY IS THE SAME THROUGHOUT and is what these cases check: a shop
   * reads its OWN words, and a shop that has typed none reads neutral ones —
   * never another trade's. Only the thing in the middle keeps moving.
   *
   * NOTHING THIS DEPLOYMENT RENDERS MOVED when the layer went. Its stored
   * type was `"other"`, whose preset was `{}`, so `DEFAULT_LABELS` already
   * stood — verified against the live settings document, not assumed.
   */
  it("reads the shop's own words, whatever it typed", () => {
    expect(
      resolveLabels({ productWord: "Gateau", productWordPlural: "Gateaux" }),
    ).toMatchObject({ productWord: "Gateau", productWordPlural: "Gateaux" });

    /* A florist and a phone shop, through the same one rule. */
    expect(resolveLabels({ productWord: "Bouquet" })).toMatchObject({ productWord: "Bouquet" });
    expect(resolveLabels({ categoryWord: "Brand" })).toMatchObject({ categoryWord: "Brand" });

    /*
      THE HEADING TOO, AND WITH A VALUE THAT IS NOT THE DEFAULT.

      A mutation found this gap: hardcoding `collectionsTitle: base.collectionsTitle`
      — throwing the override away entirely — passed every wording spec in the
      suite. This shop STORES "Our Collections", which is exactly the neutral
      default, so every fixture built from it reads the same whether the
      override is honoured or ignored. The fixture has to be a word the
      default is not.
    */
    expect(resolveLabels({ collectionsTitle: "Our Shelf" }).collectionsTitle).toBe("Our Shelf");
    expect(resolveLabels({ collectionsSubtitle: "Pick a shelf." }).collectionsSubtitle).toBe(
      "Pick a shelf.",
    );
  });

  it("and neutral ones when it has typed none — never another trade's", () => {
    /*
      THE HALF THE MIGRATION EXISTED TO PROTECT. A shop that has said nothing
      must not be told what it sells. "Cake" here would be the bug every
      version of this mechanism was built to avoid.
    */
    const labels = resolveLabels({});
    expect(labels.productWord).toBe("Product");
    expect(labels.productWordPlural).toBe("Products");
    expect(labels.categoryWord).toBe("Category");
    expect(labels.collectionsTitle).toBe("Our Collections");

    /* And a blank string counts as having typed nothing, not as a word. */
    expect(resolveLabels({ productWord: "   " }).productWord).toBe("Product");
  });

  /*
    NO CASE PINS THE SIGNATURE, and that is deliberate rather than an
    oversight. `resolveLabels(overrides, businessType)` took a trade second;
    TYPESCRIPT is what refuses a caller reaching for it now, and it did —
    removing the parameter produced exactly five compile errors, one per
    production call site. A runtime check adds nothing a build does not
    already stop, and the first one written here asserted
    `resolveLabels.length === 1`, which is 0 for a function with a default
    parameter — a case about JavaScript trivia rather than about this shop.
  */

  it("and no settings repair touches a document on a read", () => {
    /**
     * The repair that used to `$unset` the trade ran on the singleton read
     * every server render funnels through. It is gone, and it must not come
     * back for the removal either: a stored `businessType` is stripped by the
     * Zod object on the next ordinary save, which needs no repair at all.
     */
    const repairs = planSettingsRepairs({
      general: { businessType: "bakery" },
      labelOverrides: undefined,
    });

    expect(repairs).toEqual([]);
  });
});
