import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "SAME-DAY DELIVERY" IS PROMISED ONLY WHEN CHECKOUT ALLOWS IT.
 *
 * Found in the zone review (2026-10-28): the PIN answer and the checkout map
 * said "Same-day delivery" from the zone's own days, while checkout's earliest
 * date was tomorrow — the shop's one-day lead time — and, past the shop's
 * same-day cutoff, today is not offered either. The soonest day is now the
 * later of the zone's and the shop's, pushed a day past the cutoff.
 */

const shop = vi.hoisted(() => ({ deliveryLeadDays: 0, sameDayCutoff: "" }));
vi.mock("@/features/settings/lib/settings-repository", () => ({
  getCommerceSettings: () => shop,
}));

import { soonestDeliveryDays, soonestDeliveryText } from "@/features/commerce/lib/delivery-location";

// The shop's wall clock: 10:00 and 18:00 on a day.
const morning = new Date(2026, 9, 28, 10, 0);
const evening = new Date(2026, 9, 28, 18, 0);

beforeEach(() => {
  shop.deliveryLeadDays = 0;
  shop.sameDayCutoff = "";
});

describe("the soonest delivery day", () => {
  it("is the shop's lead time when it is later than the zone's — not 'same-day'", () => {
    shop.deliveryLeadDays = 1;
    expect(soonestDeliveryDays(0, morning)).toBe(1);
    expect(soonestDeliveryText(soonestDeliveryDays(0, morning))).toBe("From the next day");
  });

  it("is the zone's when the zone is the later", () => {
    shop.deliveryLeadDays = 1;
    expect(soonestDeliveryDays(3, morning)).toBe(3);
  });

  it("is same-day before the cutoff, and the next day after it", () => {
    shop.sameDayCutoff = "14:00";
    expect(soonestDeliveryText(soonestDeliveryDays(0, morning))).toBe("Same-day delivery");
    expect(soonestDeliveryText(soonestDeliveryDays(0, evening))).toBe("From the next day");
  });

  it("says nothing for a zone that does not say", () => {
    expect(soonestDeliveryDays(null, morning)).toBeNull();
    expect(soonestDeliveryText(null)).toBeNull();
  });
});
