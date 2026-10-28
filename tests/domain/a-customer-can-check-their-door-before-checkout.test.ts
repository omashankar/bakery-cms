import { afterEach, describe, expect, it } from "vitest";

import type { DeliveryZone, PincodePlace } from "@/types/delivery";
import { lookUpDeliveryPincode, readDeliveryLocation, saveDeliveryLocation } from "@/features/commerce/lib/delivery-location";

/**
 * A CUSTOMER CAN FIND OUT BEFORE CHECKOUT.
 *
 * Walked through as a customer (2026-10-27): with delivery decided by the map
 * pin, the product page, cart and header answered every PIN with "it depends"
 * — the customer learned whether they were served only on checkout's map.
 * Now a PIN answers what it can (a whole district or state, from India Post),
 * and a drawn area sends the customer to check their exact address.
 */

const base = { city: "", pincode: "", radiusKm: 0, minDeliveryDays: 0, estimatedDeliveryDays: 1, isActive: true, priority: 50, createdAt: "", updatedAt: "" };
const talwandi: DeliveryZone = { ...base, id: "t", name: "Talwandi", coverage: "radius", center: { lat: 25.1415, lng: 75.8475 }, radiusKm: 1.5, deliveryCharge: 40 };
const kota: DeliveryZone = { ...base, id: "k", name: "Rest of Kota district", coverage: "cities", cities: ["Kota"], deliveryCharge: 80, minDeliveryDays: 1 };
const rules = { useZoneBasedDelivery: true, deliverOutsideZones: false, zoneFallbackDeliveryFee: 149, deliveryFee: 99 };
const kotaPin: PincodePlace = { pincode: "324005", state: "Rajasthan", districts: ["Kota"], areas: ["Vigyan Nagar"] };
const jaipurPin: PincodePlace = { pincode: "302001", state: "Rajasthan", districts: ["Jaipur"], areas: ["Jaipur GPO"] };

afterEach(() => localStorage.clear());

describe("what a PIN can answer", () => {
  it("says yes, with the charge, for a PIN in a whole-district zone", () => {
    expect(lookUpDeliveryPincode([kota], "324005", rules, kotaPin)).toMatchObject({
      served: true,
      zoneName: "Rest of Kota district",
      charge: 80,
      minDeliveryDays: 1,
    });
  });

  it("says a drawn area inside may cost less at one door", () => {
    expect(lookUpDeliveryPincode([kota, talwandi], "324005", rules, kotaPin)).toMatchObject({ served: true, charge: 80, priceMayVary: true });
    expect(lookUpDeliveryPincode([kota], "324005", rules, kotaPin)?.priceMayVary).toBeUndefined();
  });

  it("sends the customer to check their door when only drawn areas could hold it", () => {
    expect(lookUpDeliveryPincode([talwandi], "324005", rules, kotaPin)).toMatchObject({ served: true, needsPin: true, areaNames: ["Talwandi"] });
  });

  it("says no for a PIN outside every district and state, when no area is drawn", () => {
    expect(lookUpDeliveryPincode([kota], "302001", rules, jaipurPin)?.served).toBe(false);
  });

  it("neither yes nor no when India Post could not be asked", () => {
    expect(lookUpDeliveryPincode([kota], "324005", rules, undefined)).toMatchObject({ needsPin: true });
  });
});

describe("the spot a customer checked", () => {
  it("is remembered, for checkout's map to open on", () => {
    saveDeliveryLocation({ pincode: "", label: "Talwandi", location: { lat: 25.142, lng: 75.848 } });
    expect(readDeliveryLocation()).toEqual({ pincode: "", label: "Talwandi", location: { lat: 25.142, lng: 75.848 } });
  });

  it("drops a location that is not a real point, keeping the PIN", () => {
    localStorage.setItem("bakery-cms-delivery-location", JSON.stringify({ pincode: "324005", label: "", location: { lat: 0, lng: 0 } }));
    expect(readDeliveryLocation()).toEqual({ pincode: "324005", label: "" });
  });
});
