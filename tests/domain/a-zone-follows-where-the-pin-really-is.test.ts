import { describe, expect, it } from "vitest";

import type { DeliveryZone } from "@/types/delivery";
import {
  describePincodeCode,
  listDistricts,
  lookUpPincode,
  PINCODE_DIRECTORY_UPDATED,
} from "@/features/commerce/server/pincode-directory";
import { findDeliveryZone } from "@/features/commerce/lib/delivery-zone-utils";
import { lookUpDeliveryPincode } from "@/features/commerce/lib/delivery-location";
import { checkZoneDraft, closestDistricts, readPincodeList } from "@/features/commerce/lib/delivery-zone-validation";
import { INDIAN_STATES, matchStateName, stateForPincode } from "@/features/commerce/lib/india-states";
import { calculateDeliveryQuote } from "@/features/orders/lib/delivery-pricing";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";

/**
 * A ZONE FOLLOWS WHERE THE PIN REALLY IS.
 *
 * The owner asked (2026-10-23) for zones that work by real location. They were
 * matched on guesses: the state from a PIN's first three digits (wrong for 100
 * real PINs — Mohali's 160055 counted as Chandigarh), a city from whatever the
 * customer typed (so typing "Kota" at a Mumbai PIN bought Kota's rate), and a
 * PIN rule was never checked against a real PIN at all. India Post's own
 * directory now decides all three.
 */

let n = 0;
function zone(patch: Partial<DeliveryZone>): DeliveryZone {
  n += 1;
  return {
    id: `z${n}`,
    name: `Zone ${n}`,
    city: "",
    pincode: "",
    radiusKm: 0,
    deliveryCharge: 100,
    minDeliveryDays: 0,
    estimatedDeliveryDays: 1,
    isActive: true,
    priority: 50,
    createdAt: "",
    updatedAt: "",
    ...patch,
  };
}

const rules = { useZoneBasedDelivery: true, deliverOutsideZones: false, zoneFallbackDeliveryFee: 149, deliveryFee: 99 };

describe("India Post's directory", () => {
  it("knows the real place at a PIN, and that a made-up PIN is not one", () => {
    const talwandi = lookUpPincode("324005");
    expect(talwandi).toMatchObject({ state: "Rajasthan", districts: ["Kota"] });
    // India Post's October 2025 list; Talwandi's office closed after June 2024.
    expect(talwandi?.areas).toContain("Vigyan Nagar");
    expect(lookUpPincode("324099")).toBeNull();
  });

  it("counts the real PINs under a prefix, so a typo covers nothing", () => {
    const kota = describePincodeCode("3240");
    expect(kota).toMatchObject({ kind: "prefix", summary: { count: 10, districts: ["Kota"] } });
    expect(describePincodeCode("3499")).toMatchObject({ kind: "prefix", summary: { count: 0 } });
  });

  it("is a complete, dated build of the latest list", () => {
    // A truncated export once lost 1,031 real PINs (342002 Jodhpur among
    // them); the build now refuses one, and these are the canaries.
    expect(PINCODE_DIRECTORY_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(PINCODE_DIRECTORY_UPDATED >= "2025-10-03").toBe(true);
    for (const pin of ["342002", "500064", "783135", "110001", "794116"]) {
      expect(lookUpPincode(pin), pin).not.toBeNull();
    }
    expect(lookUpPincode("999999")).toBeNull();
  });

  it("names every state the way the zones do", () => {
    const states = new Set(listDistricts().map((entry) => entry.state));
    for (const state of states) expect(INDIAN_STATES).toContain(matchStateName(state));
    expect(states.size).toBe(INDIAN_STATES.length);
  });
});

describe("the real place decides the zone", () => {
  const kotaDistrict = zone({ id: "kota", name: "Kota", coverage: "cities", cities: ["Kota"] });

  it("matches a district zone from the PIN, whatever the customer typed as city", () => {
    const place = lookUpPincode("324005");
    expect(findDeliveryZone([kotaDistrict], { pincode: "324005", city: "Talwandi", place })?.zone.id).toBe("kota");
  });

  it("does not sell Kota's rate to a Mumbai PIN that typed Kota", () => {
    const place = lookUpPincode("400001");
    expect(findDeliveryZone([kotaDistrict], { pincode: "400001", city: "Kota", place })).toBeNull();
  });

  it("still reads the typed city when India Post does not list the PIN", () => {
    expect(findDeliveryZone([kotaDistrict], { pincode: "324099", city: "Kota", place: null })?.zone.id).toBe("kota");
  });

  it("takes the state from the real place, where the digits guess wrong", () => {
    const punjab = zone({ id: "pb", coverage: "states", states: ["Punjab"] });
    const place = lookUpPincode("160055");
    expect(stateForPincode("160055")).toBe("Chandigarh");
    expect(place?.state).toBe("Punjab");
    expect(findDeliveryZone([punjab], { pincode: "160055", place })?.zone.id).toBe("pb");
    expect(findDeliveryZone([punjab], { pincode: "160055" })).toBeNull();
  });

  it("prices delivery from the place it is given", () => {
    const quote = calculateDeliveryQuote(
      { subtotal: 100, pincode: "400001", city: "Kota", place: lookUpPincode("400001") },
      { ...defaultCommerceSettings, useZoneBasedDelivery: true, deliverOutsideZones: false },
      [kotaDistrict],
    );
    expect(quote.deliverable).toBe(false);
  });

  it("tells the storefront a PIN is not real, rather than covered or not", () => {
    expect(lookUpDeliveryPincode([kotaDistrict], "324099", rules, null)).toMatchObject({
      served: false,
      unknownPincode: true,
    });
    expect(lookUpDeliveryPincode([kotaDistrict], "324005", rules, lookUpPincode("324005"))).toMatchObject({
      served: true,
      zoneName: "Kota",
    });
  });
});

describe("a zone cannot be saved over places that do not exist", () => {
  const directory = Object.fromEntries(["324099", "3499", "3240"].map((code) => [code, describePincodeCode(code)]));
  const base = { name: "New", city: "", pincode: "", radiusKm: 0, deliveryCharge: 99, minDeliveryDays: 0, estimatedDeliveryDays: 1, isActive: true, priority: 50 };

  it("refuses a PIN India Post does not have, and a prefix no PIN starts with", () => {
    const entries = readPincodeList("324099, 3499");
    const { errors } = checkZoneDraft({
      zone: { ...base, coverage: "pincodes", pincodes: ["324099", "3499"] },
      pincodeEntries: entries,
      excludedEntries: [],
      others: [],
      directory,
    });
    expect(errors.join(" ")).toContain("324099 is not a real PIN code");
    expect(errors.join(" ")).toContain("No real PIN code starts with 3499");
  });

  it("accepts a real prefix", () => {
    const { errors } = checkZoneDraft({
      zone: { ...base, coverage: "pincodes", pincodes: ["3240"] },
      pincodeEntries: readPincodeList("3240"),
      excludedEntries: [],
      others: [],
      directory,
    });
    expect(errors).toEqual([]);
  });

  it("refuses a district name India Post does not use, and suggests the real one", () => {
    const { errors } = checkZoneDraft({
      zone: { ...base, coverage: "cities", cities: ["Kotah", "Bundi"] },
      pincodeEntries: [],
      excludedEntries: [],
      others: [],
      districts: listDistricts(),
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"Kotah" is not a district');
    expect(errors[0]).toContain('"Kota"');
    expect(closestDistricts("Kotah", listDistricts())).toContain("Kota");
  });
});
