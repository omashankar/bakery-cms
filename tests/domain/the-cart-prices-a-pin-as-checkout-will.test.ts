import { describe, expect, it } from "vitest";

import { calculateDeliveryQuote } from "@/features/orders/lib/delivery-pricing";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import type { DeliveryZone } from "@/types/delivery";

/**
 * THE CART PRICES A PIN AS CHECKOUT WILL.
 *
 * Found in the zone review (2026-10-28): with no map pin yet, nothing matched
 * a zone, so the cart's Delivery row showed the fallback fee — ₹149 for a PIN
 * the product page had just quoted at its district's ₹40, and the Total with
 * it. A whole district or state the PIN is in now prices it, and a spot (the
 * customer's own, or one the shop gives for the PIN) prices a drawn area.
 */

const base = { city: "", pincode: "", radiusKm: 0, estimatedDeliveryDays: 1, isActive: true, priority: 50, createdAt: "", updatedAt: "" };
const district = { ...base, id: "d", name: "Kota district", coverage: "cities", cities: ["Kota"], deliveryCharge: 40, minDeliveryDays: 1 } as DeliveryZone;
const circle = { ...base, id: "k", name: "Kota city", coverage: "areas", deliveryCharge: 99, minDeliveryDays: 0, areas: [{ kind: "radius", center: { lat: 25.165795, lng: 75.868835 }, radiusKm: 10 }] } as DeliveryZone;
const commerce = { ...defaultCommerceSettings, useZoneBasedDelivery: true, deliverOutsideZones: false, zoneFallbackDeliveryFee: 149, freeDeliveryThreshold: 5000 };
const kota = { state: "Rajasthan", districts: ["Kota"] };

describe("a cart with a PIN and no pin on the map", () => {
  it("is priced by the district zone the PIN is in — not the fallback", () => {
    expect(calculateDeliveryQuote({ subtotal: 500, pincode: "324005", region: kota }, commerce, [district])).toMatchObject({ delivery: 40, zoneId: "d" });
  });

  it("is priced by a drawn area when given a spot inside it", () => {
    expect(calculateDeliveryQuote({ subtotal: 500, pincode: "324002", region: kota, location: { lat: 25.21, lng: 75.89 } }, commerce, [circle, district])).toMatchObject({ delivery: 99, zoneId: "k" });
  });

  it("still takes nothing it cannot judge as refused — no spot, no district zone: the fallback, deliverable", () => {
    expect(calculateDeliveryQuote({ subtotal: 500, pincode: "324005", region: kota }, commerce, [circle])).toMatchObject({ delivery: 149, deliverable: true });
  });
});
