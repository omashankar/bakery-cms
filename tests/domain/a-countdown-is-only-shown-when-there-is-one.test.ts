import { describe, expect, it } from "vitest";

import { timeLeftToday } from "@/apps/website/lib/product-details";

/**
 * "07:55:24 hours left for today's delivery" is the most persuasive line on the
 * page, and the easiest to make up.
 *
 * The reference storefront shows one on every product. This shop shows one only
 * where an owner has said when same-day orders actually close — a timer with
 * nothing behind it is a pressure tactic, not information, and it sits directly
 * under the button a customer is deciding whether to press.
 *
 * The arithmetic is a pure function so it can be tested against a fixed clock
 * rather than by waiting for a second to pass.
 */

const at = (hours: number, minutes: number, seconds = 0) =>
  new Date(2026, 8, 5, hours, minutes, seconds);

describe("how long is left before same-day orders close", () => {
  it("counts down to the cutoff", () => {
    expect(timeLeftToday("17:00", at(9, 4, 36))).toBe("07:55:24");
  });

  it("pads every part to two digits", () => {
    // "9:5:6" reads as nothing; a clock is a clock.
    expect(timeLeftToday("17:00", at(16, 54, 54))).toBe("00:05:06");
  });

  it("says nothing once the cutoff has passed", () => {
    /**
     * The one that matters. A countdown that has run out is worse than none:
     * it is still on the page telling somebody to hurry for a delivery they
     * can no longer have.
     */
    expect(timeLeftToday("17:00", at(17, 0, 1))).toBeNull();
    expect(timeLeftToday("17:00", at(21, 30))).toBeNull();
  });

  it("says nothing at the exact moment it closes", () => {
    expect(timeLeftToday("17:00", at(17, 0, 0))).toBeNull();
  });

  it("says nothing when the shop has named no cutoff", () => {
    expect(timeLeftToday("", at(9, 0))).toBeNull();
    expect(timeLeftToday("   ", at(9, 0))).toBeNull();
  });

  it("says nothing rather than guessing at a time it cannot read", () => {
    // Whatever reaches this — an old settings document, a hand-edited row — is
    // not going to be turned into a deadline.
    for (const bad of ["5pm", "17:70", "24:00", "9:00", "17", "17:00:00"]) {
      expect(timeLeftToday(bad, at(9, 0)), bad).toBeNull();
    }
  });

  it("counts the whole day for a cutoff at midnight's end", () => {
    expect(timeLeftToday("23:59", at(0, 0, 0))).toBe("23:59:00");
  });
});

describe("the note under the photo", () => {
  it("is nothing until the shop writes it", async () => {
    /**
     * "Design and icing may vary from the image shown" is true of a handmade
     * cake and false of a sealed charger, so it is the shop's claim to make.
     * The shipped default is blank — a default here would be this software
     * putting words in every shop's mouth.
     */
    const { defaultCommerceSettings } = await import("@/features/settings/lib/settings-utils");

    expect(defaultCommerceSettings.productImageNote).toBe("");
    expect(defaultCommerceSettings.sameDayCutoff).toBe("");
  });

  it("survives the write path the settings screen posts through", async () => {
    const { commerceSchema } = await import("@/features/settings/server/settings.validators");

    const parsed = commerceSchema.safeParse({
      ...(await import("@/features/settings/lib/settings-utils")).defaultCommerceSettings,
      productImageNote: "Design may vary from the image shown.",
      sameDayCutoff: "17:00",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.productImageNote).toBe("Design may vary from the image shown.");
      expect(parsed.data.sameDayCutoff).toBe("17:00");
    }
  });

  it("refuses a cutoff that is not a time", async () => {
    // It drives a deadline a customer acts on; "5pm" would silently render
    // nothing and the owner would never know their timer was off.
    const { commerceSchema } = await import("@/features/settings/server/settings.validators");
    const { defaultCommerceSettings } = await import("@/features/settings/lib/settings-utils");

    expect(
      commerceSchema.safeParse({ ...defaultCommerceSettings, sameDayCutoff: "5pm" }).success,
    ).toBe(false);
    expect(
      commerceSchema.safeParse({ ...defaultCommerceSettings, sameDayCutoff: "" }).success,
    ).toBe(true);
  });
});
