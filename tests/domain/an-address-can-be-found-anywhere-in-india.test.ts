import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AddressSearchUnavailableError,
  clearSearchCache,
  indiaPostSuggestions,
  readPhotonResponse,
  searchAddresses,
} from "@/features/commerce/server/osm-search.server";
import { clearGeocodeCache } from "@/features/commerce/server/osm-geocoding.server";

/**
 * AN ADDRESS CAN BE FOUND ANYWHERE IN INDIA.
 *
 * Measured on 36 places across every kind of state and union territory
 * (2026-10-28): Photon found localities, towns and villages everywhere in
 * English, but no Hindi name, labelled a PIN ", Ladpura Tehsil", put 799001
 * at 799008, sent "Kota district" to Andhra Pradesh, and tagged a whole state
 * with one PIN. So: India Post answers PINs and districts itself; Nominatim
 * — which knows Hindi names — answers a PRESSED Search only (its rules forbid
 * search-as-you-type); a town or state gets no PIN; and a search that could
 * not be made says so, instead of looking like "no such place".
 */

const photonCalls: string[] = [];
const nominatimCalls: string[] = [];
let photon: () => Promise<Response>;
let nominatim: () => Promise<Response>;

const ok = (body: unknown) => async () => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
const down = async () => {
  throw new Error("network down");
};

beforeEach(() => {
  photonCalls.length = 0;
  nominatimCalls.length = 0;
  photon = ok({ features: [] });
  nominatim = ok([]);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/search?")) {
        nominatimCalls.push(url);
        return nominatim();
      }
      photonCalls.push(url);
      return photon();
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearSearchCache();
  clearGeocodeCache();
});

describe("India Post answers what it knows", () => {
  it("a PIN code, with its areas, district and state — from the shop's own data", async () => {
    const [found] = await indiaPostSuggestions("324005");
    expect(found).toMatchObject({ postalCode: "324005", city: "Kota", state: "Rajasthan", zoom: 14 });
    expect(found.label).toMatch(/^324005 · .*Kota, Rajasthan$/);
    // A real office of that PIN, in Kota.
    expect(found.location.lat).toBeCloseTo(25.14, 1);
  });

  it("'PIN 110001' as well as '110001', anywhere in India", async () => {
    const [found] = await indiaPostSuggestions("PIN 110001");
    expect(found).toMatchObject({ postalCode: "110001", state: "Delhi" });
  });

  it("files a PIN where its post offices are — India Post lists Agartala's 799001 as Telangana", async () => {
    const [found] = await indiaPostSuggestions("799001");
    expect(found).toMatchObject({ state: "Tripura", city: "West Tripura" });
  });

  it("…and leaves an enclave alone: Mahe is Puducherry, inside Kerala", async () => {
    const { lookUpPincode } = await import("@/features/commerce/server/pincode-directory");
    expect(lookUpPincode("673310")?.state).toBe("Puducherry");
  });

  it("nothing for a PIN India Post has never had", async () => {
    expect(await indiaPostSuggestions("325600")).toEqual([]);
  });

  it("a district by name — 'Kota district' is in Rajasthan, not Andhra Pradesh", async () => {
    const [found] = await indiaPostSuggestions("Kota district");
    expect(found).toMatchObject({ label: "Kota district, Rajasthan", zoom: 10 });
    expect(found.postalCode).toBeUndefined();
  });

  it("comes first in the box, before the map's own suggestions", async () => {
    photon = ok({ features: [{ geometry: { coordinates: [91.36, 23.86] }, properties: { name: "799001", state: "Tripura", postcode: "799008", type: "other", countrycode: "IN" } }] });
    const results = await searchAddresses("799001");
    expect(results[0].postalCode).toBe("799001");
  });
});

describe("Photon, as the customer types", () => {
  it("never labels a place by a PIN with a comma hanging where it was", () => {
    const [found] = readPhotonResponse({
      features: [{ geometry: { coordinates: [75.84, 25.14] }, properties: { name: "324005", county: "Ladpura Tehsil", state: "Rajasthan", postcode: "324005", type: "other", countrycode: "IN" } }],
    });
    expect(found.label.startsWith(",")).toBe(false);
    expect(found.label).toBe("Ladpura Tehsil, Rajasthan, 324005");
  });

  it("puts no PIN on a whole state or town — it is many PINs", async () => {
    photon = ok({ features: [{ geometry: { coordinates: [73.77, 26.81] }, properties: { name: "Rajasthan", state: "Rajasthan", postcode: "342902", type: "state", countrycode: "IN" } }] });
    const [found] = await searchAddresses("Rajasthan");
    expect(found).toMatchObject({ label: "Rajasthan", zoom: 7 });
    expect(found.postalCode).toBeUndefined();
  });

  it("gives a village its PIN — Photon types Sangod a 'city', OpenStreetMap a town of one PIN", async () => {
    photon = ok({ features: [{ geometry: { coordinates: [76.286, 24.925] }, properties: { name: "Sangod", county: "Sangod Tehsil", state: "Rajasthan", type: "city", osm_key: "place", osm_value: "town", countrycode: "IN" } }] });
    const [found] = await searchAddresses("Sangod");
    expect(found).toMatchObject({ postalCode: "325601", zoom: 14 });
  });

  it("never asks Nominatim per keystroke — even for Hindi", async () => {
    await searchAddresses("जयपुर");
    expect(nominatimCalls).toHaveLength(0);
  });
});

describe("a pressed Search", () => {
  it("asks Nominatim for Hindi words, and not Photon, which cannot read them", async () => {
    nominatim = ok([{ display_name: "Jaipur, Jaipur Tehsil, Jaipur, Rajasthan, 302001, India", lat: "26.9154", lon: "75.8189", addresstype: "city", address: { city: "Jaipur", state: "Rajasthan" } }]);
    const [found] = await searchAddresses("जयपुर", null, { full: true });
    expect(photonCalls).toHaveLength(0);
    expect(nominatimCalls).toHaveLength(1);
    expect(found).toMatchObject({ label: "Jaipur, Jaipur Tehsil, Rajasthan", city: "Jaipur", zoom: 12 });
    expect(found.postalCode).toBeUndefined();
  });

  it("asks Nominatim when Photon found nothing — and gives a street its India Post PIN", async () => {
    nominatim = ok([{ display_name: "Kota Junction, Station Road, Nayapura, Kota, Rajasthan, 324001, India", lat: "25.2236", lon: "75.8820", addresstype: "railway", address: { city: "Kota", state: "Rajasthan" } }]);
    const [found] = await searchAddresses("Kota Junction railway station", null, { full: true });
    expect(found.label).toBe("Kota Junction, Station Road, Nayapura, Kota, Rajasthan 324002");
    expect(found.postalCode).toBe("324002");
  });

  it("asks Nominatim even when Photon answered, and puts its answer first — the customer did not find it there", async () => {
    // Measured: Photon offers "Shastri Nagar, Adyar" for T Nagar; Nominatim finds Thiyagaraya Nagar.
    photon = ok({ features: [{ geometry: { coordinates: [80.26, 12.999] }, properties: { name: "Shastri Nagar", city: "Chennai", state: "Tamil Nadu", type: "district", countrycode: "IN" } }] });
    nominatim = ok([{ display_name: "Thiyagaraya Nagar, Chennai, Tamil Nadu, 600017, India", lat: "13.0418", lon: "80.2341", addresstype: "suburb", address: { suburb: "Thiyagaraya Nagar", city: "Chennai", state: "Tamil Nadu" } }]);
    const results = await searchAddresses("T Nagar, Chennai", null, { full: true });
    expect(nominatimCalls).toHaveLength(1);
    expect(results[0].label).toMatch(/^Thiyagaraya Nagar, Chennai, Tamil Nadu/);
    expect(results.some((place) => place.label.startsWith("Shastri Nagar"))).toBe(true);
  });

  it("does not ask Nominatim while the customer only types", async () => {
    photon = ok({ features: [] });
    await searchAddresses("T Nagar, Chennai");
    expect(nominatimCalls).toHaveLength(0);
  });
});

describe("when search cannot be made", () => {
  it("says so — it is not 'no such place'", async () => {
    photon = down;
    await expect(searchAddresses("Talwandi Kota")).rejects.toBeInstanceOf(AddressSearchUnavailableError);
  });

  it("still answers a PIN from the shop's own data with every service down", async () => {
    photon = down;
    nominatim = down;
    const [found] = await searchAddresses("560034", null, { full: true });
    expect(found.postalCode).toBe("560034");
  });

  it("an empty answer is an answer, not a failure", async () => {
    await expect(searchAddresses("zzqqxx nowhere")).resolves.toEqual([]);
  });
});
