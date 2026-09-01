import { beforeEach, describe, expect, it } from "vitest";

import { resolveLabels } from "@/features/settings/server/business-labels.server";
import {
  defaultAppSettings,
  mergeAppSettings,
} from "@/features/settings/lib/settings-utils";
import { SERVER_SECTIONS } from "@/features/settings/lib/settings-api";
import {
  getLabelSettings,
  loadSettings,
  saveSettings,
} from "@/features/settings/lib/settings-repository";

/**
 * The shop's own word for what it sells, which never reached a screen.
 *
 * `labelOverrides` has existed server-side for as long as business types have:
 * `resolveLabels` layers it over the per-type preset and `getSettings` /
 * `getPublicSettings` both ship the result as `settings.labels`. Nothing read
 * it. `useBusinessLabels` resolved from `businessType` alone and threw the
 * server's answer away, so the one mechanism that let a shop say "Bouquet"
 * instead of "Cake" was inert, and the field was in no client type, no default,
 * no merge, and no backup section.
 *
 * That matters beyond wording: `getBusinessLabels` falls back to the BAKERY
 * labels, so deleting `businessType` — the next step — would silently return
 * the admin sidebar, the products list and the storefront collections heading
 * to "Cake" with nothing to override them. This net is what makes that step
 * safe, and it did not exist: a grep of tests/ for `resolveLabels`,
 * `getBusinessLabels`, `BUSINESS_LABELS` and `labelOverrides` returned nothing.
 */

beforeEach(() => {
  localStorage.clear();
});

describe("an override beats the default wording", () => {
  it("uses the shop's word where it gave one", () => {
    const labels = resolveLabels({
      productWord: "Bouquet",
      productWordPlural: "Flowers",
    });

    expect(labels.productWord).toBe("Bouquet");
    expect(labels.productWordPlural).toBe("Flowers");
  });

  it("falls back to the preset for the fields it left alone", () => {
    const labels = resolveLabels({ productWord: "Bouquet" });

    expect(labels.productWordPlural).toBe("Products");
    expect(labels.collectionsTitle).toBe("Our Collections");
  });

  it("treats blank and whitespace as 'no opinion', not as an empty label", () => {
    // An admin clearing the box must get the preset back, not a nameless button.
    const labels = resolveLabels({ productWord: "   ", collectionsTitle: "" });

    expect(labels.productWord).toBe("Product");
    expect(labels.collectionsTitle).toBe("Our Collections");
  });
});

describe("the client can hold it", () => {
  it("is part of the settings shape, with a default", () => {
    // It was in none of these, so every client read dropped it on the floor.
    expect(defaultAppSettings.labelOverrides).toBeDefined();
    expect(mergeAppSettings({}).labelOverrides).toEqual({});
  });

  it("survives a merge that carries it", () => {
    const merged = mergeAppSettings({ labelOverrides: { productWord: "Bouquet" } });

    expect(merged.labelOverrides.productWord).toBe("Bouquet");
  });

  it("is an object even when a stored copy carries the key as undefined", () => {
    /**
     * `mergeAppSettings` spreads `...partial` over the defaults, so an explicit
     * `labelOverrides: undefined` — which is what parsing a settings document
     * written before this field existed produces — would set it to undefined
     * and make every reader crash on a property access. The per-section line is
     * what turns that back into `{}`, and without this the line looks redundant
     * against the spread.
     */
    const merged = mergeAppSettings({ labelOverrides: undefined });

    expect(merged.labelOverrides).toEqual({});
  });

  it("round-trips through the local store", () => {
    saveSettings(
      mergeAppSettings({
        ...loadSettings(),
        labelOverrides: { productWord: "Charger", productWordPlural: "Chargers" },
      }),
    );

    expect(getLabelSettings().productWord).toBe("Charger");
    expect(getLabelSettings().productWordPlural).toBe("Chargers");
  });
});

describe("it is a real settings section", () => {
  it("is one the server accepts, so a save is not silently local", () => {
    // Absent from this list, a section can be written to localStorage and never
    // reach Mongo — the shop's own word would survive until the next device.
    expect(SERVER_SECTIONS).toContain("labelOverrides");
  });

  it("is restored by a backup rather than dropped", () => {
    /**
     * `hydrateSettingsFromServer` rebuilds the local object section by section,
     * by hand. A section missing from that list is discarded on every hydrate —
     * which is the same shape of bug, in the same file, and why this asserts on
     * the section list rather than on one screen.
     */
    const restored = mergeAppSettings({
      ...defaultAppSettings,
      labelOverrides: { productWord: "Bouquet" },
    });

    expect(restored.labelOverrides.productWord).toBe("Bouquet");
  });
});
