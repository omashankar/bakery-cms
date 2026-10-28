import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DeliveryZone, LatLng } from "@/types/delivery";
import { findDeliveryZoneForPin } from "@/features/commerce/lib/delivery-area";
import { verifyDeliveryPin } from "@/features/commerce/server/delivery-pin-check.server";
import { clearGeocodeCache } from "@/features/commerce/server/osm-geocoding.server";

/**
 * A WHOLE DISTRICT OR STATE, DECIDED BY WHERE THE PIN IS.
 *
 * The owner asked (2026-10-27) to deliver state-wise and area-wise as well as
 * in drawn circles. The narrowest wins — a drawn area, then a district, then
 * a state — and the district and state are the PIN's location's, from the
 * map; the typed PIN stands in only when the map cannot say.
 */

const TALWANDI: LatLng = { lat: 25.1415, lng: 75.8475 };
const IN_TALWANDI: LatLng = { lat: 25.142, lng: 75.848 };
const KOTA_OUTSKIRTS: LatLng = { lat: 25.25, lng: 75.95 };
const BUNDI: LatLng = { lat: 25.44, lng: 75.64 };
const INDORE: LatLng = { lat: 22.72, lng: 75.86 };

const base = { city: "", pincode: "", radiusKm: 0, minDeliveryDays: 0, estimatedDeliveryDays: 1, isActive: true, priority: 50, createdAt: "", updatedAt: "" };
const talwandi: DeliveryZone = { ...base, id: "talwandi", name: "Talwandi", coverage: "radius", center: TALWANDI, radiusKm: 1.5, deliveryCharge: 40 };
const kota: DeliveryZone = { ...base, id: "kota", name: "Rest of Kota district", coverage: "cities", cities: ["Kota"], deliveryCharge: 80 };
const rajasthan: DeliveryZone = { ...base, id: "rj", name: "Rajasthan", coverage: "states", states: ["Rajasthan"], deliveryCharge: 150 };
const zones = [talwandi, kota, rajasthan];

function osm(state: string, district: string, postcode?: string) {
  return { display_name: `${district}, ${state}, India`, address: { town: district, state_district: district, state, ...(postcode ? { postcode } : {}) } };
}

function stubMap(answer: unknown) {
  const fetchMock = vi.fn(
    typeof answer === "function"
      ? (answer as () => Promise<Response>)
      : async () => ({ ok: true, status: 200, json: async () => answer }) as unknown as Response,
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => clearGeocodeCache());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("which zone holds a pin", () => {
  it("is the drawn area first, then the district, then the state", () => {
    const region = { state: "Rajasthan", districts: ["Kota"] };
    expect(findDeliveryZoneForPin(zones, IN_TALWANDI, region)?.zone.id).toBe("talwandi");
    expect(findDeliveryZoneForPin(zones, KOTA_OUTSKIRTS, region)?.zone.id).toBe("kota");
    expect(findDeliveryZoneForPin(zones, BUNDI, { state: "Rajasthan", districts: ["Bundi"] })?.zone.id).toBe("rj");
    expect(findDeliveryZoneForPin(zones, INDORE, { state: "Madhya Pradesh", districts: ["Indore"] })).toBeNull();
  });

  it("answers only from drawn areas when the pin's region is not known", () => {
    expect(findDeliveryZoneForPin(zones, KOTA_OUTSKIRTS, null)).toBeNull();
    expect(findDeliveryZoneForPin(zones, IN_TALWANDI, null)?.zone.id).toBe("talwandi");
  });

  it("ignores a switched-off district or state", () => {
    const off = [{ ...kota, isActive: false }, { ...rajasthan, isActive: false }];
    expect(findDeliveryZoneForPin(off, KOTA_OUTSKIRTS, { state: "Rajasthan", districts: ["Kota"] })).toBeNull();
  });
});

describe("the server finds the pin's district and state (OpenStreetMap mocked)", () => {
  const check = (location: LatLng, pincode: string) =>
    verifyDeliveryPin({ location, pincode, city: "", state: "Rajasthan", zones, deliverOutsideZones: false });

  it("reads the map's district — 'Kota District' is India Post's Kota", async () => {
    stubMap(osm("Rajasthan", "Kota District"));
    const verdict = await check(KOTA_OUTSKIRTS, "324008");
    expect(verdict.status).toBe("eligible");
    if (verdict.status === "eligible") {
      expect(verdict.zone?.id).toBe("kota");
      expect(verdict.region).toEqual({ state: "Rajasthan", districts: ["Kota"] });
    }
  });

  it("falls to the state zone for a pin elsewhere in the state", async () => {
    stubMap(osm("Rajasthan", "Bundi"));
    const verdict = await check(BUNDI, "323001");
    expect(verdict.status === "eligible" && verdict.zone?.id).toBe("rj");
  });

  it("refuses a pin in a state no zone covers", async () => {
    stubMap(osm("Madhya Pradesh", "Indore"));
    expect((await check(INDORE, "452001")).status).toBe("outside");
  });

  it("with the map down, lets the typed PIN's India Post district decide", async () => {
    stubMap(async () => Promise.reject(Object.assign(new Error("down"), { name: "TimeoutError" })));
    const verdict = await check(KOTA_OUTSKIRTS, "324008"); // Thermal Colony, Kota
    expect(verdict.status === "eligible" && verdict.zone?.id).toBe("kota");
  });

  it("asks no map for a pin inside a drawn area", async () => {
    const fetchMock = stubMap(osm("Rajasthan", "Kota"));
    const verdict = await verifyDeliveryPin({ location: IN_TALWANDI, pincode: "", zones: [talwandi], deliverOutsideZones: false });
    expect(verdict.status).toBe("eligible");
    // Asked once, for the PIN check — never needed to choose the zone.
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

describe("the price follows the district the server found", () => {
  beforeEach(() => vi.resetModules());

  it("charges the district zone's fee, not the state's", async () => {
    stubMap(osm("Rajasthan", "Kota"));
    vi.doMock("@/features/products/server/product.repository", () => ({
      findBySlug: vi.fn(async () => ({ slug: "truffle", name: "Truffle", image: "/c.jpg", price: 500, category: "Cakes" })),
    }));
    vi.doMock("@/features/settings/server/settings.service", () => ({
      getSettings: vi.fn(async () => ({
        commerce: { deliveryFee: 99, freeDeliveryThreshold: 999, useZoneBasedDelivery: true, deliverOutsideZones: false },
      })),
    }));
    vi.doMock("@/features/commerce/server/commerce.service", () => ({
      getCoupons: vi.fn(async () => []),
      getZones: vi.fn(async () => zones),
    }));
    const { priceCart } = await import("@/features/checkout/server/pricing.server");
    const quote = await priceCart({
      items: [{ productSlug: "truffle", quantity: 1 }],
      deliveryAddress: { addressLine1: "Thermal Colony", pincode: "324008", city: "Kota", state: "Rajasthan", location: KOTA_OUTSKIRTS },
    });
    expect(quote.totals.delivery).toBe(80);
    expect(quote.totals.deliveryZoneName).toBe("Rest of Kota district");
  });
});

describe("choosing several districts or states", () => {
  it("covers every one chosen, in one zone", () => {
    const north = { ...rajasthan, id: "north", states: ["Rajasthan", "Madhya Pradesh", "Gujarat"] };
    const hadoti = { ...kota, id: "hadoti", cities: ["Kota", "Bundi", "Baran", "Jhalawar"] };
    expect(findDeliveryZoneForPin([north, hadoti], BUNDI, { state: "Rajasthan", districts: ["Bundi"] })?.zone.id).toBe("hadoti");
    expect(findDeliveryZoneForPin([north, hadoti], INDORE, { state: "Madhya Pradesh", districts: ["Indore"] })?.zone.id).toBe("north");
    expect(findDeliveryZoneForPin([north, hadoti], INDORE, { state: "Delhi", districts: ["New Delhi"] })).toBeNull();
  });

  it("refuses one district in two zones, naming it as the owner wrote it", async () => {
    const { checkZoneDraft } = await import("@/features/commerce/lib/delivery-zone-validation");
    const { listDistricts } = await import("@/features/commerce/server/pincode-directory");
    const problems = checkZoneDraft({
      zone: { ...base, name: "Another", deliveryCharge: 60, coverage: "cities", cities: ["Kota"] },
      pincodeEntries: [],
      excludedEntries: [],
      others: [kota],
      districts: listDistricts(),
    });
    expect(problems.errors.join(" ")).toContain('Kota is already in "Rest of Kota district". One district can be in only one zone.');
  });

  it("warns that a name two states share covers both", async () => {
    const { checkZoneDraft } = await import("@/features/commerce/lib/delivery-zone-validation");
    const { listDistricts } = await import("@/features/commerce/server/pincode-directory");
    const problems = checkZoneDraft({
      zone: { ...base, name: "Bilaspur", deliveryCharge: 60, coverage: "cities", cities: ["Bilaspur"] },
      pincodeEntries: [],
      excludedEntries: [],
      others: [],
      districts: listDistricts(),
    });
    expect(problems.errors).toEqual([]);
    expect(problems.warnings.join(" ")).toMatch(/"Bilaspur" is a district in 2 states — .*Chhattisgarh.*Himachal Pradesh/);
  });
});
