import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  addDays,
  isBeforeLeadTime,
  isPastSameDayCutoff,
  isPastTimeSlot,
  timeSlotEndsAt,
} from "@/features/orders/lib/delivery-date";

/**
 * A shop that delivers same-day had no delivery-date check at all.
 *
 * `isBeforeLeadTime` opened `if (!chosen || !Number.isFinite(leadDays) ||
 * leadDays <= 0) return false;` — so the moment this shop set its lead time to
 * 0, the only date guard the server has switched itself off. Its two callers,
 * the checkout quote and `placeOrder`, then accepted "2020-01-01" as happily as
 * tomorrow, and the Zod schemas check only that the string is a real calendar
 * day. The browser's `min=` on the date input was the whole defence, and a
 * direct POST does not have one.
 *
 * Zero means "today is early enough", not "any day will do".
 *
 * And nothing anywhere looked at the CLOCK. The date floor answers "is this day
 * far enough ahead" and `isOfferedTimeSlot` answers "is this a window the shop
 * offers" — neither asks whether the window has been and gone. So a same-day
 * shop took an order at 11pm for that morning's 10:00 AM to 12:00 PM delivery,
 * printed it on the invoice and pushed it to the kitchen as a delivery it owes.
 *
 * Two rules close that, and both are pure functions of the shop's own data: a
 * window whose end has passed cannot be chosen for today, and neither can today
 * at all once the shop's own `sameDayCutoff` has gone by.
 *
 * `sameDayCutoff` could not be saved. It is on `CommerceSettings`, it is
 * validated, it has a field on the Commerce screen — and it was never a
 * Mongoose path, so strict mode dropped it on every write. That is why this
 * shop's cutoff is empty: not because nobody set one.
 */

/** Local components, never an instant string — a delivery date is a calendar day. */
const NOON = new Date(2026, 8, 7, 12, 0, 0);
const ELEVEN_PM = new Date(2026, 8, 7, 23, 0, 0);
const TODAY = "2026-09-07";
const TOMORROW = "2026-09-08";

const MORNING = "10:00 AM – 12:00 PM";
const EVENING = "6:00 PM – 8:00 PM";

describe("a lead time of zero is still a floor", () => {
  it("refuses a date in the past", () => {
    // The regression: at 0 the guard used to return false before it looked.
    expect(isBeforeLeadTime("2020-01-01", 0, NOON)).toBe(true);
    expect(isBeforeLeadTime(addDays(TODAY, -30), 0, NOON)).toBe(true);
  });

  it("still lets today and tomorrow through, which is what same-day means", () => {
    expect(isBeforeLeadTime(TODAY, 0, NOON)).toBe(false);
    expect(isBeforeLeadTime(TOMORROW, 0, NOON)).toBe(false);
  });

  it("keeps the one day of slack it was written with", () => {
    /**
     * Deliberate, and documented on the function: the customer's calendar and
     * the server's can legitimately differ by a day, and this runs where a
     * refusal is most expensive. So yesterday passes at any lead time; the day
     * before it does not.
     */
    expect(isBeforeLeadTime(addDays(TODAY, -1), 0, NOON)).toBe(false);
    expect(isBeforeLeadTime(addDays(TODAY, -2), 0, NOON)).toBe(true);
  });

  it("does not move for any other lead time", () => {
    expect(isBeforeLeadTime(TODAY, 1, NOON)).toBe(false);
    expect(isBeforeLeadTime(addDays(TODAY, -2), 1, NOON)).toBe(true);
    expect(isBeforeLeadTime(TOMORROW, 3, NOON)).toBe(true);
    expect(isBeforeLeadTime(addDays(TODAY, 3), 3, NOON)).toBe(false);
  });

  it("says nothing when there is no date or no number", () => {
    expect(isBeforeLeadTime("", 0, NOON)).toBe(false);
    expect(isBeforeLeadTime(TODAY, Number.NaN, NOON)).toBe(false);
  });
});

describe("reading a shop's own wording for a window", () => {
  it("takes the END of a twelve-hour range", () => {
    expect(timeSlotEndsAt(MORNING)).toBe(12 * 60);
    expect(timeSlotEndsAt(EVENING)).toBe(20 * 60);
  });

  it("gets noon and midnight the right way round", () => {
    // 12pm is noon and 12am is midnight: the hour wraps, the half-day does not.
    expect(timeSlotEndsAt("11:00 AM – 12:00 PM")).toBe(720);
    expect(timeSlotEndsAt("11:30 PM – 12:30 AM")).toBe(30);
  });

  it("reads a plain range as a 24-hour clock", () => {
    expect(timeSlotEndsAt("10:00 - 12:00")).toBe(720);
    expect(timeSlotEndsAt("18:00 - 20:00")).toBe(1200);
  });

  it("survives the hyphen the shop actually typed", () => {
    // normaliseTimeSlot folds the dashes, so an en dash and a hyphen agree.
    expect(timeSlotEndsAt("10:00 AM - 12:00 PM")).toBe(timeSlotEndsAt(MORNING));
  });

  it("declines to guess at wording it cannot read", () => {
    for (const wording of ["", "Evening", "Any time", "25:99 to 26:00"]) {
      expect(timeSlotEndsAt(wording), `${wording} was guessed at`).toBeNull();
    }
  });
});

describe("a window that has closed", () => {
  it("cannot be ordered for today", () => {
    expect(isPastTimeSlot(TODAY, MORNING, ELEVEN_PM)).toBe(true);
    expect(isPastTimeSlot(TODAY, EVENING, ELEVEN_PM)).toBe(true);
  });

  it("is closed the minute it ends, not a minute later", () => {
    expect(isPastTimeSlot(TODAY, MORNING, new Date(2026, 8, 7, 11, 59, 0))).toBe(false);
    expect(isPastTimeSlot(TODAY, MORNING, new Date(2026, 8, 7, 12, 0, 0))).toBe(true);
  });

  it("says nothing about a day that is not today", () => {
    // A date before today is the lead time's question, and a later date has no
    // window that has passed yet.
    expect(isPastTimeSlot(TOMORROW, MORNING, ELEVEN_PM)).toBe(false);
    expect(isPastTimeSlot(addDays(TODAY, -1), MORNING, ELEVEN_PM)).toBe(false);
  });

  it("leaves a window it cannot read alone", () => {
    // The same choice `isOfferedTimeSlot` makes for a shop with no slots at all.
    expect(isPastTimeSlot(TODAY, "Evening", ELEVEN_PM)).toBe(false);
    expect(isPastTimeSlot(TODAY, "", ELEVEN_PM)).toBe(false);
    expect(isPastTimeSlot("", MORNING, ELEVEN_PM)).toBe(false);
  });
});

describe("the shop's own closing time for today", () => {
  it("enforces nothing until the shop names one", () => {
    // An empty cutoff is a shop that has not said, not a shop that closes at
    // midnight — and empty is what every shop has today.
    expect(isPastSameDayCutoff(TODAY, "", ELEVEN_PM)).toBe(false);
  });

  it("closes today once it has gone by", () => {
    expect(isPastSameDayCutoff(TODAY, "14:00", ELEVEN_PM)).toBe(true);
    expect(isPastSameDayCutoff(TODAY, "14:00", new Date(2026, 8, 7, 14, 0, 0))).toBe(true);
    expect(isPastSameDayCutoff(TODAY, "14:00", new Date(2026, 8, 7, 13, 59, 0))).toBe(false);
  });

  it("has no opinion about a later day", () => {
    expect(isPastSameDayCutoff(TOMORROW, "14:00", ELEVEN_PM)).toBe(false);
  });

  it("ignores a cutoff the admin field would not have accepted", () => {
    for (const typed of ["2pm", "14", "24:00", "9:00"]) {
      expect(isPastSameDayCutoff(TODAY, typed, ELEVEN_PM), `${typed} was read`).toBe(false);
    }
  });
});

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("and the shop can enforce what it has set", () => {
  it("can finally save a cutoff at all", async () => {
    /**
     * The gate that made the setting a fiction. `commerceSchema` declared
     * `deliveryFee` through `paymentMethods` and neither of these two, so
     * Mongoose strict mode dropped both on every write — the admin typed a
     * closing time, the form said saved, and nothing reached the database.
     */
    const { SettingsModel } = await import("@/lib/server/db/models/settings.model");
    const doc = new SettingsModel({
      commerce: { sameDayCutoff: "14:00", productImageNote: "Serving suggestion" },
    });

    const stored = doc.toObject() as {
      commerce: { sameDayCutoff?: string; productImageNote?: string };
    };

    expect(stored.commerce.sameDayCutoff).toBe("14:00");
    expect(stored.commerce.productImageNote).toBe("Serving suggestion");
  });

  it("refuses a closed window at the quote, where refusing is still free", () => {
    const controller = read("features/checkout/server/checkout.controller.ts");

    expect(controller).toContain("isPastSameDayCutoff(input.deliverySlot.date");
    expect(controller).toContain("isPastTimeSlot(input.deliverySlot.date");
  });

  it("refuses it at placement too, for a cart that never quoted", () => {
    /**
     * Guarded on `!draft`, like the slot list and the minimum order beside it:
     * a customer who quoted at 11:55 and paid at 12:05 must not be refused
     * after the gateway has captured.
     */
    const service = read("features/orders/server/order.service.ts");
    const block = service.slice(service.indexOf("And a window that has not already closed"));

    expect(block).toContain("isPastSameDayCutoff");
    expect(block).toContain("isPastTimeSlot");
    expect(block.slice(0, block.indexOf("isPastSameDayCutoff"))).toContain("!draft");
  });

  it("does not offer the customer a window the quote will refuse", () => {
    const page = read("apps/website/checkout/pages/checkout-page.tsx");

    expect(page).toContain("!isPastTimeSlot(deliverySlot.date, slot)");
    expect(page).toContain("isPastSameDayCutoff(floor, commerce.sameDayCutoff)");
  });
});
