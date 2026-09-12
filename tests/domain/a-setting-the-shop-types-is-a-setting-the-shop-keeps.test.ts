import { describe, expect, it } from "vitest";

import { SettingsModel } from "@/lib/server/db/models/settings.model";
import {
  defaultCommerceSettings,
  defaultGeneralSettings,
} from "@/features/settings/lib/settings-utils";

/**
 * A SETTING WITH NO MONGOOSE PATH IS A FORM THAT LIES.
 *
 * Mongoose strict mode drops an undeclared path on write, silently. So a
 * setting can be declared on the TypeScript type, validated by Zod, given a
 * default, given an admin field, and read all over the app — every one of which
 * says the feature works — and still go nowhere when the owner presses Save.
 * The form says "saved". The value is gone on the next load. Nothing logs.
 *
 * This has now happened three times in this repo. `sameDayCutoff` and
 * `productImageNote` each shipped that way and carry a note in
 * `settings.model.ts` recording it — the shop's closing time was unset for
 * exactly that reason, and the countdown it drives never appeared. Then
 * `deliveryTiers` did it again: a whole multi-speed delivery feature, with an
 * admin editor and pricing behind it, that could not have been saved.
 *
 * Nothing in the suite could fail for any of them, because every other layer
 * was correct. This is the layer nobody checks, so it is checked here.
 */

/** The paths this sub-schema actually declares, flattened one level. */
function declaredPaths(section: string): Set<string> {
  const schema = SettingsModel.schema.path(section) as unknown as {
    schema?: { paths: Record<string, unknown> };
  };

  const inner = schema?.schema?.paths;
  expect(inner, `${section} is not a sub-schema on SettingsModel`).toBeTruthy();

  return new Set(
    Object.keys(inner!)
      // Nested paths arrive dotted ("paymentMethods.cod"); the top-level name
      // is what a settings key has to match.
      .map((path) => path.split(".")[0]!)
      .filter((name) => name !== "_id" && name !== "__v"),
  );
}

describe("every commerce setting has somewhere to be stored", () => {
  it("declares a Mongoose path for each key the shop can set", () => {
    const declared = declaredPaths("commerce");
    const missing = Object.keys(defaultCommerceSettings).filter((key) => !declared.has(key));

    expect(
      missing,
      `these commerce settings have no Mongoose path, so Mongoose drops them on save: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("and would have caught all three of the ones that got through", () => {
    /**
     * The three that shipped unsaveable. Naming them keeps this test honest
     * about what it is for — if any is ever removed from the settings type,
     * this line fails and says so rather than passing on an empty check.
     */
    const declared = declaredPaths("commerce");

    for (const key of ["sameDayCutoff", "productImageNote", "deliveryTiers"]) {
      expect(key in defaultCommerceSettings, `${key} left CommerceSettings`).toBe(true);
      expect(declared.has(key), `${key} has no Mongoose path`).toBe(true);
    }
  });
});

describe("and every general setting does too", () => {
  it("declares a Mongoose path for each key", () => {
    // The same trap, the same shape, a different section — worth holding both
    // rather than waiting for it to happen here as well.
    const declared = declaredPaths("general");
    const missing = Object.keys(defaultGeneralSettings).filter((key) => !declared.has(key));

    expect(
      missing,
      `these general settings have no Mongoose path: ${missing.join(", ")}`,
    ).toEqual([]);
  });
});
