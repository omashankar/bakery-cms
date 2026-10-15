import { describe, expect, it } from "vitest";

import { earliestDeliveryLabel } from "@/features/orders/lib/delivery-date";

// The shop's wall clock: 14 Oct 2026, local time.
const at = (hh: number, mm = 0) => new Date(2026, 9, 14, hh, mm);

describe("the earliest delivery a product card promises", () => {
  it("is today for a same-day shop before its cutoff", () => {
    expect(earliestDeliveryLabel(0, "14:00", at(10))).toBe("Today");
  });

  it("is tomorrow once the cutoff has passed, as the date picker will insist", () => {
    expect(earliestDeliveryLabel(0, "14:00", at(14))).toBe("Tomorrow");
    expect(earliestDeliveryLabel(0, "14:00", at(22, 30))).toBe("Tomorrow");
  });

  it("is today all day for a same-day shop with no cutoff", () => {
    expect(earliestDeliveryLabel(0, "", at(23))).toBe("Today");
  });

  it("follows the lead time, and ignores a cutoff a next-day shop does not use", () => {
    expect(earliestDeliveryLabel(1, "14:00", at(9))).toBe("Tomorrow");
    expect(earliestDeliveryLabel(1, "14:00", at(20))).toBe("Tomorrow");
  });

  it("names the day when it is further out", () => {
    expect(earliestDeliveryLabel(3, "", at(9))).toBe("Sat, 17 Oct");
  });

  it("crosses a month the calendar's way", () => {
    expect(earliestDeliveryLabel(0, "14:00", new Date(2026, 9, 31, 15))).toBe("Tomorrow");
    expect(earliestDeliveryLabel(2, "", new Date(2026, 9, 31, 9))).toBe("Mon, 2 Nov");
  });
});
