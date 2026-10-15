import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  isOfferedTimeSlot,
  isPastSameDayCutoff,
  isPastTimeSlot,
  normaliseTimeSlot,
  offeredWindows,
  shopClockNow,
} from "@/features/orders/lib/delivery-date";
import { placeOrderSchema } from "@/features/orders/server/order.validators";
import { quoteSchema } from "@/features/checkout/server/checkout.validators";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/**
 * WHEN the customer asked for the cake was never checked as hard as WHAT they
 * ordered.
 *
 * `deliverySlot` was `{ date: z.string(), timeSlot: z.string() }.passthrough()`,
 * and `commerce.deliveryTimeSlots` was read in exactly two places — the admin
 * page that edits it and the storefront dropdown that renders it. So three
 * things were true at once, all confirmed against the running app:
 *
 *   - `date: "whenever you like"` was accepted and stored, and every surface
 *     that prints a delivery date reads it back verbatim — the invoice, the
 *     WhatsApp alert to the bakery, the confirmation email, the order screen.
 *     The lead-time guard compares strings, and "whenever you like" sorts after
 *     any ISO date, so it waved it through.
 *   - a slot the bakery had REMOVED (nobody is there at 8pm any more) was still
 *     accepted, and printed as a delivery the shop is expected to make.
 *   - `.passthrough()` stored anything else the caller attached:
 *     `{ note: "CALL ME AT 3AM" }` came back on the order document.
 */
const ORDER = {
  items: [{ id: "1", productSlug: "cake", name: "Cake", price: 100, quantity: 1 }],
  totals: {
    subtotal: 100,
    delivery: 0,
    tax: 0,
    discount: 0,
    platformCharge: 0,
    giftWrapFee: 0,
    taxableAmount: 100,
    total: 100,
    itemCount: 1,
  },
  address: {
    fullName: "A",
    email: "a@example.com",
    phone: "9000000000",
    addressLine1: "1 Lane",
    city: "Mumbai",
    state: "MH",
    pincode: "400001",
  },
  paymentMethod: "cod" as const,
};

const parseOrder = (deliverySlot: unknown) =>
  placeOrderSchema.safeParse({ ...ORDER, deliverySlot });

describe("the delivery date has to be a date", () => {
  it("refuses a sentence", () => {
    expect(parseOrder({ date: "whenever you like", timeSlot: "" }).success).toBe(false);
    expect(parseOrder({ date: "tomorrow", timeSlot: "" }).success).toBe(false);
    expect(parseOrder({ date: "", timeSlot: "" }).success).toBe(false);
  });

  it("refuses a day that does not exist", () => {
    // The regex alone accepts these; only the calendar check rejects them.
    expect(parseOrder({ date: "2026-02-30", timeSlot: "" }).success).toBe(false);
    expect(parseOrder({ date: "2026-13-01", timeSlot: "" }).success).toBe(false);
    expect(parseOrder({ date: "2027-02-29", timeSlot: "" }).success).toBe(false);
  });

  it("accepts real dates, including a leap day", () => {
    expect(parseOrder({ date: "2026-08-15", timeSlot: "" }).success).toBe(true);
    expect(parseOrder({ date: "2028-02-29", timeSlot: "" }).success).toBe(true);
  });

  it("keeps only the two fields an order carries", () => {
    const parsed = parseOrder({
      date: "2026-08-15",
      timeSlot: "10:00 AM – 12:00 PM",
      note: "CALL ME AT 3AM",
      injected: { anything: true },
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.deliverySlot).toEqual({
      date: "2026-08-15",
      timeSlot: "10:00 AM – 12:00 PM",
    });
  });

  it("bounds the slot, which is printed on an invoice and pushed into WhatsApp", () => {
    expect(parseOrder({ date: "2026-08-15", timeSlot: "x".repeat(61) }).success).toBe(false);
    expect(parseOrder({ date: "2026-08-15", timeSlot: "x".repeat(60) }).success).toBe(true);
  });

  it("applies the same rule at the quote, where a refusal is still free", () => {
    const quote = (deliverySlot: unknown) =>
      quoteSchema.safeParse({
        items: [{ productSlug: "cake", quantity: 1 }],
        deliverySlot,
      });

    expect(quote({ date: "whenever you like" }).success).toBe(false);
    expect(quote({ date: "2026-02-30" }).success).toBe(false);
    expect(quote({ date: "2026-08-15" }).success).toBe(true);
    // The quote runs before the customer has necessarily chosen anything.
    expect(quote({}).success).toBe(true);
  });
});

describe("a delivery time the shop actually offers", () => {
  const OFFERED = [
    "10:00 AM – 12:00 PM",
    "12:00 PM – 2:00 PM",
    "2:00 PM – 4:00 PM",
  ];

  it("accepts one from the list", () => {
    expect(isOfferedTimeSlot("12:00 PM – 2:00 PM", OFFERED)).toBe(true);
  });

  it("refuses one the shop removed", () => {
    // The 8pm slot the bakery dropped because nobody is there.
    expect(isOfferedTimeSlot("6:00 PM – 8:00 PM", OFFERED)).toBe(false);
    expect(isOfferedTimeSlot("3:00 AM – 4:00 AM", OFFERED)).toBe(false);
  });

  it("is forgiving about how the same window is written", () => {
    // A hyphen typed by hand is the same delivery window as the stored en dash.
    expect(isOfferedTimeSlot("10:00 am - 12:00 pm", OFFERED)).toBe(true);
    expect(isOfferedTimeSlot("  10:00 AM   –  12:00 PM  ", OFFERED)).toBe(true);
    expect(normaliseTimeSlot("10:00 AM — 12:00 PM")).toBe(normaliseTimeSlot("10:00 am - 12:00 pm"));
  });

  it("has nothing to check when the shop defines no slots", () => {
    expect(isOfferedTimeSlot("anything", [])).toBe(true);
    expect(isOfferedTimeSlot("anything", ["", "  "])).toBe(true);
  });

  it("allows a customer who chose no time at all", () => {
    expect(isOfferedTimeSlot("", OFFERED)).toBe(true);
    expect(isOfferedTimeSlot("   ", OFFERED)).toBe(true);
  });
});

/**
 * The rule needs the shop's settings, so it lives in the service rather than
 * the schema — checked at both ends, and at placement only for a cart that was
 * never quoted, so a captured payment is not stranded by an admin editing the
 * slot list mid-checkout.
 */
describe("where the offered-slot rule is applied", () => {

  it("is enforced at placement, for an unquoted cart", () => {
    const service = source("features/orders/server/order.service.ts");

    expect(service).toMatch(/isOfferedTimeSlot\(\s*input\.deliverySlot\.timeSlot,\s*offeredWindows\(commerce,/);
    expect(service).toMatch(/!draft &&\s*input\.deliverySlot\?\.timeSlot/);
  });

  it("is enforced at the quote, before any money moves", () => {
    const controller = source("features/checkout/server/checkout.controller.ts");

    expect(controller).toMatch(/isOfferedTimeSlot\(\s*input\.deliverySlot\.timeSlot,\s*offeredWindows\(quote\.commerce,/);
  });
});

describe("a delivery speed's own windows", () => {
  /*
    The server checked only the shop-wide list, so a speed with its own windows
    ("Midnight", 11:30 PM – 12:00 AM) was refused at the quote for every
    customer who picked it, and could not be bought.
  */
  const commerce = {
    deliveryTimeSlots: ["10:00 AM – 12:00 PM"],
    deliveryTiers: [
      { id: "midnight", windows: ["11:30 PM – 12:00 AM"] },
      { id: "next-day", windows: [] as string[] },
    ],
  };

  it("are the ones offered when that speed is chosen", () => {
    expect(isOfferedTimeSlot("11:30 PM – 12:00 AM", offeredWindows(commerce, "midnight"))).toBe(true);
    expect(isOfferedTimeSlot("10:00 AM – 12:00 PM", offeredWindows(commerce, "midnight"))).toBe(false);
  });

  it("fall back to the shop-wide list with no speed, or an unknown one", () => {
    expect(offeredWindows(commerce, undefined)).toEqual(["10:00 AM – 12:00 PM"]);
    expect(offeredWindows(commerce, "gone")).toEqual(["10:00 AM – 12:00 PM"]);
  });
});

describe("the shop's clock, not the server's", () => {
  /*
    The cutoff and window checks read `new Date()`'s local getters, and the
    server runs in UTC: a 14:00 same-day cutoff closed at 19:30 IST.
  */
  it("closes a 14:00 cutoff at 14:00 in Kolkata", () => {
    // 09:00 UTC is 14:30 IST.
    const now = shopClockNow("Asia/Kolkata", new Date("2026-10-09T09:00:00.000Z"));
    expect(isPastSameDayCutoff("2026-10-09", "14:00", now)).toBe(true);
    // The server's own clock at the same instant says 09:00 — still open.
    const before = shopClockNow("Asia/Kolkata", new Date("2026-10-09T08:00:00.000Z")); // 13:30 IST
    expect(isPastSameDayCutoff("2026-10-09", "14:00", before)).toBe(false);
  });

  it("knows it is already tomorrow in Kolkata at 20:00 UTC", () => {
    // 20:00 UTC on the 9th is 01:30 IST on the 10th.
    const now = shopClockNow("Asia/Kolkata", new Date("2026-10-09T20:00:00.000Z"));
    expect(isPastTimeSlot("2026-10-10", "10:00 AM – 12:00 PM", now)).toBe(false);
    expect(isPastSameDayCutoff("2026-10-10", "01:00", now)).toBe(true);
  });

  it("stops the admin screen inventing a slot nobody chose", () => {
    const page = source("apps/admin/commerce/pages/delivery-slots-admin-page.tsx");

    // An all-blank list used to be silently replaced with a demo slot, saved
    // under a toast that said "Delivery slots saved", and then offered to
    // every customer at checkout.
    expect(page).not.toContain('cleanedSlots.length > 0 ? cleanedSlots : ["10:00 AM – 12:00 PM"]');
    expect(page).toContain("Add at least one delivery time");
  });
});
