import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DeliveryZone, LatLng } from "@/types/delivery";
import {
  distanceKm,
  findAreaZone,
  isValidLatLng,
  pointInPolygon,
  rankAreaZones,
  readPolygonText,
  zoneContainsPoint,
} from "@/features/commerce/lib/delivery-area";
import { verifyDeliveryPin } from "@/features/commerce/server/delivery-pin-check.server";
import { clearGeocodeCache, readNominatimResponse } from "@/features/commerce/server/osm-geocoding.server";
import { readPhotonResponse } from "@/features/commerce/server/osm-search.server";
import { deliveryPinSchema, quoteSchema } from "@/features/checkout/server/checkout.validators";

/**
 * THE MAP PIN DECIDES DELIVERY, NOT THE PIN CODE.
 *
 * The owner's test order (2026-10-26): a Kota address with Sangod's PIN,
 * 325601, was taken for the Sangod zone. Now (owner, 2026-10-27) the customer
 * pins their door on a free OpenStreetMap map; the server refuses a pin
 * outside every active delivery area, and an address whose PIN or state the
 * pin contradicts. The PIN at the pin is read from India Post's own post
 * offices (2026-10-28), not the map's patchy postal codes; where no post
 * office is near, the area check alone decides ("PIN na mile to order hone do").
 * OpenStreetMap is mocked throughout.
 */

const SANGOD: LatLng = { lat: 24.9227, lng: 76.2869 };
const IN_SANGOD: LatLng = { lat: 24.9301, lng: 76.2912 }; // ~1 km from the centre
const KOTA: LatLng = { lat: 25.18, lng: 75.83 }; // ~55 km away

let n = 0;
function zone(patch: Partial<DeliveryZone>): DeliveryZone {
  n += 1;
  return {
    id: `z${n}`,
    name: `Zone ${n}`,
    city: "",
    pincode: "",
    radiusKm: 0,
    deliveryCharge: 60,
    minDeliveryDays: 0,
    estimatedDeliveryDays: 1,
    isActive: true,
    priority: 50,
    createdAt: "",
    updatedAt: "",
    ...patch,
  };
}

const sangodZone = () => zone({ id: "sangod", name: "Sangod", coverage: "radius", center: SANGOD, radiusKm: 5 });

/** Nominatim's reverse answer for a point, as the real service shapes it. */
function osm(postcode: string | null, state = "Rajasthan", town = "Sangod") {
  return {
    place_id: 1,
    display_name: `Ward 4, ${town}, Kota, ${state}${postcode ? `, ${postcode}` : ""}, India`,
    address: {
      town,
      state_district: "Kota",
      state,
      ...(postcode ? { postcode } : {}),
      country_code: "in",
    },
  };
}

function stubMap(answer: unknown | (() => Promise<Response>)) {
  const fetchMock = vi.fn(
    typeof answer === "function"
      ? (answer as () => Promise<Response>)
      : async () => ({ ok: true, status: 200, json: async () => answer }) as unknown as Response,
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  clearGeocodeCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const address = { pincode: "325601", city: "Sangod", state: "Rajasthan" };

describe("the geometry", () => {
  it("measures a real distance", () => {
    expect(distanceKm(SANGOD, KOTA)).toBeGreaterThan(50);
    expect(distanceKm(SANGOD, KOTA)).toBeLessThan(60);
  });

  it("holds a pin on the circle's edge, and not one just past it", () => {
    const circle = sangodZone();
    // Due north, 5 km and 5.05 km.
    const kmPerLat = distanceKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(zoneContainsPoint(circle, { lat: SANGOD.lat + 4.999 / kmPerLat, lng: SANGOD.lng })).toBe(true);
    expect(zoneContainsPoint(circle, { lat: SANGOD.lat + 5.05 / kmPerLat, lng: SANGOD.lng })).toBe(false);
  });

  it("reads a drawn boundary: inside, outside, and on its line", () => {
    const square = [
      { lat: 25, lng: 76 },
      { lat: 25, lng: 76.1 },
      { lat: 25.1, lng: 76.1 },
      { lat: 25.1, lng: 76 },
    ];
    expect(pointInPolygon({ lat: 25.05, lng: 76.05 }, square)).toBe(true);
    expect(pointInPolygon({ lat: 25.2, lng: 76.05 }, square)).toBe(false);
    // On an edge and on a corner count as inside — the door the owner drew to.
    expect(pointInPolygon({ lat: 25, lng: 76.05 }, square)).toBe(true);
    expect(pointInPolygon({ lat: 25.1, lng: 76.1 }, square)).toBe(true);
    // A concave notch: inside the bounding box, outside the shape.
    const ell = [
      { lat: 0.1, lng: 0.1 },
      { lat: 0.1, lng: 2 },
      { lat: 1, lng: 2 },
      { lat: 1, lng: 1 },
      { lat: 2, lng: 1 },
      { lat: 2, lng: 0.1 },
    ];
    expect(pointInPolygon({ lat: 1.5, lng: 1.5 }, ell)).toBe(false);
    expect(pointInPolygon({ lat: 0.5, lng: 1.5 }, ell)).toBe(true);
  });

  it("10. gives an overlap to the smaller area, then to priority — and ignores a switched-off zone", () => {
    // The smaller area is the DEARER one, so only its size can make it win.
    const town = zone({ id: "town", coverage: "radius", center: SANGOD, radiusKm: 10, deliveryCharge: 40 });
    const near = zone({ id: "near", coverage: "radius", center: SANGOD, radiusKm: 3, deliveryCharge: 90 });
    expect(findAreaZone([town, near], IN_SANGOD)?.zone.id).toBe("near");
    expect(rankAreaZones([town, near], IN_SANGOD).map((m) => m.zone.id)).toEqual(["near", "town"]);

    const twinA = zone({ id: "a", coverage: "radius", center: SANGOD, radiusKm: 3, priority: 10 });
    const twinB = zone({ id: "b", coverage: "radius", center: SANGOD, radiusKm: 3, priority: 90 });
    expect(findAreaZone([twinA, twinB], IN_SANGOD)?.zone.id).toBe("b");

    expect(findAreaZone([{ ...near, isActive: false }], IN_SANGOD)).toBeNull();
  });

  it("refuses a point that is not one — 0,0 is a missing coordinate", () => {
    for (const bad of [{ lat: 0, lng: 0 }, { lat: 91, lng: 76 }, { lat: Number.NaN, lng: 76 }, { lat: "25", lng: 76 }, null]) {
      expect(isValidLatLng(bad)).toBe(false);
    }
    expect(readPolygonText("25.1, 76.2\nnot a point\n25.2 76.3").points).toHaveLength(2);
  });
});

describe("checking a pin (OpenStreetMap mocked)", () => {
  it("1. allows a pin inside the zone whose map PIN is the address's PIN", async () => {
    stubMap(osm("325601"));
    const verdict = await verifyDeliveryPin({ location: IN_SANGOD, ...address, zones: [sangodZone()], deliverOutsideZones: false });
    expect(verdict.status).toBe("eligible");
    if (verdict.status !== "eligible") return;
    expect(verdict.zone?.id).toBe("sangod");
    expect(verdict.verification).toMatchObject({
      postalCode: "325601",
      pincodeCheck: "matched",
      zoneId: "sangod",
      lat: IN_SANGOD.lat,
    });
  });

  it("2. refuses Sangod's PIN on a Kota pin — without asking the map at all", async () => {
    const fetchMock = stubMap(osm("324002", "Rajasthan", "Kota"));
    const verdict = await verifyDeliveryPin({ location: KOTA, ...address, zones: [sangodZone()], deliverOutsideZones: false });
    expect(verdict).toMatchObject({
      status: "outside",
      message: "This location is outside our delivery area. Please select an eligible delivery address.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("3. refuses a real PIN whose pin is outside every zone", async () => {
    stubMap(osm("324002"));
    const verdict = await verifyDeliveryPin({
      location: KOTA,
      pincode: "324002",
      city: "Kota",
      state: "Rajasthan",
      zones: [sangodZone()],
      deliverOutsideZones: false,
    });
    expect(verdict.status).toBe("outside");
  });

  it("3b. says where a refused pin is and how far the area is — a computer's location can be a town away", async () => {
    const fetchMock = stubMap(osm("324002"));
    const verdict = await verifyDeliveryPin({ location: KOTA, zones: [sangodZone()], deliverOutsideZones: false });
    expect(verdict.status).toBe("outside");
    if (verdict.status !== "outside") return;
    // Kota, by India Post's own offices — the map was not asked about a pin refused anyway.
    expect(verdict.found?.formattedAddress).toMatch(/Kota, Rajasthan 3240\d\d$/);
    expect(fetchMock).not.toHaveBeenCalled();
    // KOTA is ~55 km from Sangod's centre; the circle reaches 5 km of it.
    const fromCentre = distanceKm(KOTA, SANGOD);
    expect(verdict.kmToArea).toBeCloseTo(fromCentre - 5, 0);
  });

  it("3c. measures to a drawn boundary's nearest side, and is 0 inside it", async () => {
    const { kmToShape } = await import("@/features/commerce/lib/delivery-area");
    const square = { kind: "polygon" as const, polygon: [{ lat: 25, lng: 75 }, { lat: 25, lng: 75.1 }, { lat: 25.1, lng: 75.1 }, { lat: 25.1, lng: 75 }] };
    expect(kmToShape(square, { lat: 25.05, lng: 75.05 })).toBe(0);
    // 0.05° of latitude south of the bottom side: ~5.56 km.
    expect(kmToShape(square, { lat: 24.95, lng: 75.05 })).toBeCloseTo(5.56, 1);
  });

  it("4. asks for a correction when the typed PIN is in another district from the pin's", async () => {
    stubMap(osm(null));
    const verdict = await verifyDeliveryPin({
      location: IN_SANGOD,
      ...address,
      pincode: "302001", // Jaipur — same state, so only the PIN can catch it
      zones: [sangodZone()],
      deliverOutsideZones: false,
    });
    // India Post's post offices put the pin in Sangod's 325601, and say so.
    expect(verdict).toMatchObject({ status: "mismatch", field: "pincode", found: { postalCode: "325601" } });
    if (verdict.status === "mismatch") expect(verdict.message).toContain("325601");
  });

  it("4h. takes the PIN from India Post's offices, not the map — a wrong map PIN no longer refuses a right address", async () => {
    stubMap(osm("302001")); // the map's postal code, wrong: Jaipur's
    const verdict = await verifyDeliveryPin({ location: IN_SANGOD, ...address, zones: [sangodZone()], deliverOutsideZones: false });
    expect(verdict.status).toBe("eligible");
    if (verdict.status !== "eligible") return;
    expect(verdict.verification).toMatchObject({ postalCode: "325601", pincodeCheck: "matched" });
    // The address said back is the map's words with India Post's PIN — never the map's wrong one.
    expect(verdict.verification.formattedAddress).toContain("325601");
    expect(verdict.verification.formattedAddress).not.toContain("302001");
    expect(verdict.verification.formattedAddress).not.toMatch(/India$/);
  });

  it("4d. lets a neighbouring PIN in the same district through, as a note — a PIN line is nobody's map", async () => {
    stubMap(osm(null));
    const verdict = await verifyDeliveryPin({
      location: IN_SANGOD,
      ...address,
      pincode: "325602", // Kanwas, Kota district, like Sangod
      zones: [sangodZone()],
      deliverOutsideZones: false,
    });
    expect(verdict.status).toBe("eligible");
    if (verdict.status === "eligible") expect(verdict.verification).toMatchObject({ postalCode: "325601", pincodeCheck: "nearby" });
  });

  it("4e. ignores a PIN India Post has never had — measured: the map gives Sangod 325600", async () => {
    stubMap(osm("325600"));
    const verdict = await verifyDeliveryPin({ location: IN_SANGOD, ...address, zones: [sangodZone()], deliverOutsideZones: false });
    expect(verdict.status).toBe("eligible");
    if (verdict.status === "eligible") expect(verdict.verification).toMatchObject({ postalCode: "325601", pincodeCheck: "matched" });
  });

  it("4b. and when the map names a different state — the PIN and State agree, so it is the pin to move", async () => {
    stubMap(osm("325601", "Madhya Pradesh"));
    const verdict = await verifyDeliveryPin({ location: IN_SANGOD, ...address, zones: [sangodZone()], deliverOutsideZones: false });
    expect(verdict).toMatchObject({ status: "mismatch", field: "location" });
  });

  it("4g. and asks for the State to be fixed when only the State box disagrees", async () => {
    stubMap(osm(null)); // Rajasthan
    const verdict = await verifyDeliveryPin({ location: IN_SANGOD, ...address, state: "Gujarat", zones: [sangodZone()], deliverOutsideZones: false });
    expect(verdict).toMatchObject({ status: "mismatch", field: "state" });
  });

  it("4f. refuses a PIN from another state even where the map has no PIN — the map still knows the state", async () => {
    stubMap(osm(null)); // Sangod, Rajasthan, no postcode
    const verdict = await verifyDeliveryPin({
      location: IN_SANGOD,
      pincode: "110001", // New Delhi
      city: "Sangod",
      state: "Rajasthan",
      zones: [sangodZone()],
      deliverOutsideZones: false,
    });
    expect(verdict).toMatchObject({ status: "mismatch", field: "pincode" });
  });

  it("4c. knows the PIN where the map has none — India's map PINs are patchy, its post offices are not", async () => {
    stubMap(osm(null));
    const verdict = await verifyDeliveryPin({ location: IN_SANGOD, ...address, zones: [sangodZone()], deliverOutsideZones: false });
    expect(verdict.status).toBe("eligible");
    if (verdict.status === "eligible") {
      expect(verdict.verification).toMatchObject({ postalCode: "325601", pincodeCheck: "matched" });
      expect(verdict).toMatchObject({ city: "Sangod", state: "Rajasthan" });
    }
  });

  it("4j. refuses a typed PIN India Post has never had — a typo is not 'the same district'", async () => {
    stubMap(osm(null));
    const verdict = await verifyDeliveryPin({ location: IN_SANGOD, ...address, pincode: "325699", zones: [sangodZone()], deliverOutsideZones: false });
    expect(verdict).toMatchObject({ status: "mismatch", field: "pincode", found: { postalCode: "325601" } });
    if (verdict.status === "mismatch") expect(verdict.message).toContain("325699 is not a PIN code");
  });

  it("4k. never lets the typed PIN alone decide a district zone — a pin at sea with Kota's PIN is not Kota", async () => {
    stubMap({ error: "Unable to geocode" }); // the sea: no place, no state
    const sea = { lat: 15.0, lng: 71.0 };
    const kotaDistrict = zone({ id: "kd", coverage: "cities", cities: ["Kota"] });
    const verdict = await verifyDeliveryPin({ location: sea, ...address, zones: [kotaDistrict], deliverOutsideZones: false });
    expect(verdict.status).toBe("outside");
  });

  it("4i. lets the order through on the area alone where no post office is near — and says so", async () => {
    stubMap(osm(null));
    // A zone drawn out at sea, ~250 km off the coast: no post office for 30 km.
    const sea = { lat: 15.0, lng: 71.0 };
    const verdict = await verifyDeliveryPin({
      location: sea,
      ...address,
      zones: [zone({ id: "sea", coverage: "radius", center: sea, radiusKm: 5 })],
      deliverOutsideZones: false,
    });
    expect(verdict.status).toBe("eligible");
    if (verdict.status === "eligible") expect(verdict.verification).toMatchObject({ postalCode: null, pincodeCheck: "not-on-map" });
  });

  it("5. answers again when the pin is moved — outside, then onto the door", async () => {
    stubMap(osm("325601"));
    const zones = [sangodZone()];
    expect((await verifyDeliveryPin({ location: KOTA, ...address, zones, deliverOutsideZones: false })).status).toBe("outside");
    expect((await verifyDeliveryPin({ location: IN_SANGOD, ...address, zones, deliverOutsideZones: false })).status).toBe("eligible");
  });

  it("7. uses the zones it is given — a zone switched off is no zone", async () => {
    stubMap(osm("325601"));
    const off = { ...sangodZone(), isActive: false };
    expect((await verifyDeliveryPin({ location: IN_SANGOD, ...address, zones: [off], deliverOutsideZones: false })).status).toBe(
      "outside",
    );
  });

  it.each([
    ["a timeout", async () => Promise.reject(Object.assign(new Error("timed out"), { name: "TimeoutError" }))],
    ["a 500", async () => ({ ok: false, status: 500, json: async () => ({}) }) as unknown as Response],
    ["a 429 (too many)", async () => ({ ok: false, status: 429, json: async () => ({}) }) as unknown as Response],
  ])("8. with the map down (%s), the area still decides — and the PIN is still known, from India Post", async (_label, failure) => {
    stubMap(failure);
    const verdict = await verifyDeliveryPin({ location: IN_SANGOD, ...address, zones: [sangodZone()], deliverOutsideZones: false });
    expect(verdict.status).toBe("eligible");
    if (verdict.status === "eligible") expect(verdict.verification).toMatchObject({ postalCode: "325601", pincodeCheck: "matched" });
  });

  it("8b. and outside is still refused with the map down — it was never asked", async () => {
    const fetchMock = stubMap(async () => Promise.reject(new Error("down")));
    const verdict = await verifyDeliveryPin({ location: KOTA, ...address, zones: [sangodZone()], deliverOutsideZones: false });
    expect(verdict.status).toBe("outside");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks once for the same door, naming the shop as the usage policy asks", async () => {
    const fetchMock = stubMap(osm("325601"));
    const zones = [sangodZone()];
    await verifyDeliveryPin({ location: IN_SANGOD, ...address, zones, deliverOutsideZones: false });
    await verifyDeliveryPin({ location: IN_SANGOD, ...address, zones, deliverOutsideZones: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(`lat=${IN_SANGOD.lat}`);
    expect((init.headers as Record<string, string>)["User-Agent"]).toMatch(/BakeryCMS/);
  });
});

describe("reading OpenStreetMap's answers", () => {
  it("takes only a real Indian PIN as a postal code", () => {
    expect(readNominatimResponse(osm("325 601")).postalCode).toBe("325601");
    expect(readNominatimResponse(osm("3256")).postalCode).toBeNull();
    expect(readNominatimResponse({ error: "Unable to geocode" }).postalCode).toBeNull();
    expect(readNominatimResponse(osm("325601")).city).toBe("Sangod");
  });

  it("reads suggestions as places in India, each with a point", () => {
    const suggestions = readPhotonResponse({
      features: [
        {
          geometry: { coordinates: [76.2912, 24.9301] },
          properties: { name: "Sangod Bus Stand", city: "Sangod", state: "Rajasthan", postcode: "325601", countrycode: "IN" },
        },
        { geometry: { coordinates: [-0.1, 51.5] }, properties: { name: "London", countrycode: "GB" } },
        { properties: { name: "No point" } },
      ],
    });
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({ postalCode: "325601", location: { lat: 24.9301, lng: 76.2912 } });
  });
});

describe("6. what a browser may send", () => {
  it("keeps two numbers and a place id — a forged eligibility flag or zone is stripped", () => {
    const parsed = deliveryPinSchema.parse({ lat: 24.93, lng: 76.29, placeId: "p", verified: true, zoneId: "sangod" });
    expect(parsed).toEqual({ lat: 24.93, lng: 76.29, placeId: "p" });
  });

  it("refuses coordinates out of range", () => {
    const base = {
      items: [{ productSlug: "cake", quantity: 1 }],
      address: {
        fullName: "A",
        email: "a@example.com",
        phone: "1",
        addressLine1: "x",
        city: "Sangod",
        state: "Rajasthan",
        pincode: "325601",
      },
    };
    expect(quoteSchema.safeParse({ ...base, address: { ...base.address, location: { lat: 200, lng: 76 } } }).success).toBe(false);
    expect(quoteSchema.safeParse({ ...base, address: { ...base.address, location: IN_SANGOD } }).success).toBe(true);
  });
});

describe("the order is priced only for a checked pin", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function loadPricing(commerce: Record<string, unknown>, zones: DeliveryZone[]) {
    vi.doMock("@/features/products/server/product.repository", () => ({
      findBySlug: vi.fn(async () => ({ slug: "truffle", name: "Truffle", image: "/c.jpg", price: 500, category: "Cakes" })),
    }));
    vi.doMock("@/features/settings/server/settings.service", () => ({
      getSettings: vi.fn(async () => ({
        commerce: { deliveryFee: 99, freeDeliveryThreshold: 999, zoneFallbackDeliveryFee: 149, ...commerce },
      })),
    }));
    vi.doMock("@/features/commerce/server/commerce.service", () => ({
      getCoupons: vi.fn(async () => []),
      getZones: vi.fn(async () => zones),
    }));
    return import("@/features/checkout/server/pricing.server");
  }

  const items = [{ productSlug: "truffle", quantity: 1 }];
  const whole = { addressLine1: "Ward 4", pincode: "325601", city: "Sangod", state: "Rajasthan" };
  const zonesOn = { useZoneBasedDelivery: true, deliverOutsideZones: false };

  it("1. prices a checked pin at its zone's charge, and records what the SERVER found", async () => {
    stubMap(osm("325601"));
    const { priceCart } = await loadPricing(zonesOn, [sangodZone()]);
    const quote = await priceCart({ items, deliveryAddress: { ...whole, location: IN_SANGOD } });
    expect(quote.totals.delivery).toBe(60);
    expect(quote.totals.deliveryZoneName).toBe("Sangod");
    expect(quote.totals.deliveryPin).toMatchObject({ postalCode: "325601", pincodeCheck: "matched", zoneId: "sangod" });
  });

  it("2. refuses Sangod's PIN on a Kota pin", async () => {
    stubMap(osm("324002"));
    const { priceCart, OutsideDeliveryZonesError } = await loadPricing(zonesOn, [sangodZone()]);
    await expect(priceCart({ items, deliveryAddress: { ...whole, location: KOTA } })).rejects.toBeInstanceOf(
      OutsideDeliveryZonesError,
    );
  });

  it("refuses a whole address with no pin at all — a direct API call cannot skip the map", async () => {
    stubMap(osm("325601"));
    const { priceCart, DeliveryPinError } = await loadPricing(zonesOn, [sangodZone()]);
    const refusal = await priceCart({ items, deliveryAddress: whole }).catch((error: unknown) => error);
    expect(refusal).toBeInstanceOf(DeliveryPinError);
    expect((refusal as InstanceType<typeof DeliveryPinError>).problem).toBe("missing");
  });

  it("4. refuses an address whose PIN is another district's from the pin's", async () => {
    stubMap(osm(null));
    const { priceCart, DeliveryPinError } = await loadPricing(zonesOn, [sangodZone()]);
    const refusal = await priceCart({ items, deliveryAddress: { ...whole, pincode: "302001", location: IN_SANGOD } }).catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(DeliveryPinError);
    expect((refusal as InstanceType<typeof DeliveryPinError>).field).toBe("pincode");
  });

  it("7. reads the zones as they are now — switched off since the pin was checked, it is refused", async () => {
    stubMap(osm("325601"));
    const { priceCart, OutsideDeliveryZonesError } = await loadPricing(zonesOn, [{ ...sangodZone(), isActive: false }]);
    await expect(priceCart({ items, deliveryAddress: { ...whole, location: IN_SANGOD } })).rejects.toBeInstanceOf(
      OutsideDeliveryZonesError,
    );
  });

  it("8. with the map down, a pin inside the area is still priced — its PIN read from India Post", async () => {
    stubMap(async () => Promise.reject(Object.assign(new Error("timed out"), { name: "TimeoutError" })));
    const { priceCart } = await loadPricing(zonesOn, [sangodZone()]);
    const quote = await priceCart({ items, deliveryAddress: { ...whole, location: IN_SANGOD } });
    expect(quote.totals.deliveryPin).toMatchObject({ postalCode: "325601", pincodeCheck: "matched" });
  });

  it("9. leaves a shop without delivery areas as it was: no pin needed, no call to the map", async () => {
    const fetchMock = stubMap(osm("325601"));
    const { priceCart } = await loadPricing({ useZoneBasedDelivery: false }, []);
    const quote = await priceCart({ items, deliveryAddress: whole });
    expect(quote.totals.delivery).toBe(99);
    expect(quote.totals.deliveryPin).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("9b. and the running total — a PIN, no street yet — is priced without a pin", async () => {
    const fetchMock = stubMap(osm("325601"));
    const { priceCart } = await loadPricing(zonesOn, [sangodZone()]);
    const quote = await priceCart({ items, deliveryAddress: { pincode: "325601" } });
    expect(quote.totals.subtotal).toBe(500);
    // Sangod's own PIN, and still no zone: only a pin picks one.
    expect(quote.totals.deliveryZoneName).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
