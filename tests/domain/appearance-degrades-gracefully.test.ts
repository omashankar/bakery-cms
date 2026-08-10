import { describe, expect, it } from "vitest";

import {
  appearanceCssVariables,
  defaultAppearanceSettings,
  hasValidAppearanceColors,
  isValidHexColor,
  normalizeHexColor,
} from "@/features/site-layout/lib/appearance-tokens";
import { siteLayoutSchemas } from "@/features/site-layout/server/site-layout.validators";
import type { AppearanceSettings } from "@/types/appearance";

/**
 * `appearanceCssVariables` promises, in a comment at its call site, to "return
 * nothing for a palette it cannot use". It did that for a malformed STRING and
 * threw for a wrong TYPE — `isValidHexColor` called `.trim()` on its argument.
 *
 * On the storefront that throw is caught by `getStorefrontChrome`, which answers
 * with `fallbackChrome()`. So one colour field holding `null` replaced the
 * shop's brand, nav, footer and contact details with the demo ones on EVERY
 * page, and nothing said why.
 *
 * Confirmed live against the running app, with the shop's own phone number as
 * the discriminator: `"not-a-colour"` dropped the palette and kept the chrome,
 * `null` took the lot.
 */
const badTypes: unknown[] = [null, undefined, 42, {}, [], true];

describe("a colour of the wrong type", () => {
  for (const value of badTypes) {
    it(`is invalid rather than an exception: ${JSON.stringify(value) ?? "undefined"}`, () => {
      expect(() => isValidHexColor(value as string)).not.toThrow();
      expect(isValidHexColor(value as string)).toBe(false);
    });
  }

  it("does not throw when normalised either", () => {
    for (const value of badTypes) {
      expect(() => normalizeHexColor(value as string)).not.toThrow();
    }
  });

  it("makes the palette unusable without taking the page with it", () => {
    const settings = { ...defaultAppearanceSettings, primaryColor: null } as unknown as AppearanceSettings;

    expect(() => hasValidAppearanceColors(settings)).not.toThrow();
    expect(hasValidAppearanceColors(settings)).toBe(false);
    // The promise the call site relies on: nothing, not an exception.
    expect(appearanceCssVariables(settings)).toEqual({});
  });

  it("degrades the same way a malformed string already did", () => {
    const junk = { ...defaultAppearanceSettings, primaryColor: "not-a-colour" };
    const wrongType = { ...defaultAppearanceSettings, primaryColor: null } as unknown as AppearanceSettings;

    expect(appearanceCssVariables(wrongType)).toEqual(appearanceCssVariables(junk));
  });
});

describe("a palette the shop actually set", () => {
  it("still produces the tokens", () => {
    const vars = appearanceCssVariables(defaultAppearanceSettings);

    expect(vars["--brand-primary"]).toBe(defaultAppearanceSettings.primaryColor.toLowerCase());
    expect(vars["--radius"]).toBe(`${defaultAppearanceSettings.borderRadius}px`);
    expect(Object.keys(vars).length).toBeGreaterThan(10);
  });

  it("expands a three-digit hex", () => {
    expect(normalizeHexColor("#ABC")).toBe("#aabbcc");
    expect(isValidHexColor(" #abc ")).toBe(true);
  });
});

/**
 * And the way in is closed too, so a document like that cannot be written
 * again — the schema is what the backup restore posts through.
 */
describe("what the appearance endpoint will store", () => {
  const parse = (settings: unknown) => siteLayoutSchemas.appearance.safeParse(settings);

  it("refuses a colour that is not a hex string", () => {
    for (const value of badTypes) {
      expect(parse({ ...defaultAppearanceSettings, primaryColor: value }).success).toBe(false);
    }
    expect(parse({ ...defaultAppearanceSettings, accentColor: "red" }).success).toBe(false);
  });

  it("refuses a radius this design system has no token for", () => {
    expect(parse({ ...defaultAppearanceSettings, borderRadius: 9 }).success).toBe(false);
    expect(parse({ ...defaultAppearanceSettings, borderRadius: 16 }).success).toBe(true);
  });

  it("accepts the shipped palette", () => {
    expect(parse(defaultAppearanceSettings).success).toBe(true);
  });
});
