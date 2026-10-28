import { afterEach, describe, expect, it, vi } from "vitest";

import { pincodeNear } from "@/features/commerce/server/pincode-locator";
import { addressAt } from "@/features/commerce/server/delivery-pin-check.server";
import { readNominatimResponse } from "@/features/commerce/server/osm-geocoding.server";
import { clearSearchCache, searchAddresses } from "@/features/commerce/server/osm-search.server";

/**
 * A DROPPED PIN GETS ITS REAL PIN CODE.
 *
 * The owner asked (2026-10-28): "jha pin ho wha ki propar shi location or zip
 * code nikal ke aani chiaye". OpenStreetMap's Indian postal codes are patchy
 * and sometimes wrong, so the PIN is read from where India Post's own post
 * offices stand. These are the places it was measured on, against the real
 * data file — no mock.
 */

describe("pincodeNear — measured places", () => {
  it.each([
    ["Talwandi, Kota", 25.1467, 75.8407, "324005"],
    ["Vigyan Nagar, Kota", 25.1505, 75.8573, "324005"],
    ["Mahaveer Nagar, Kota", 25.1361, 75.8399, "324005"],
    ["Kota Junction", 25.2236, 75.882, "324002"],
    ["Kunhari, Kota", 25.224, 75.816, "324008"],
    ["Sangod", 24.9227, 76.2869, "325601"],
    ["Connaught Place, Delhi", 28.6315, 77.2167, "110001"],
    ["Navrangpura, Ahmedabad", 23.0365, 72.5611, "380009"],
    ["Gomti Nagar, Lucknow", 26.85, 81.0, "226010"],
  ])("%s → %s", async (_name, lat, lng, pin) => {
    expect((await pincodeNear({ lat, lng }))?.pincode).toBe(pin);
  });

  it("says a close call is one, and offers the neighbours — Borkhera sits between three PINs", async () => {
    const answer = await pincodeNear({ lat: 25.1957, lng: 75.8784 });
    expect(answer?.pincode).toBe("324002");
    expect(answer?.sure).toBe(false);
    expect(answer?.others.length).toBeGreaterThan(0);
    expect(answer?.others).not.toContain("324002");
  });

  it("is sure where one PIN's office is plainly nearest", async () => {
    const answer = await pincodeNear({ lat: 25.1361, lng: 75.8399 }); // at Mahaveer Nagar's own post office
    expect(answer).toMatchObject({ pincode: "324005", sure: true });
  });

  it("gives no PIN out at sea, rather than the nearest coast's", async () => {
    expect(await pincodeNear({ lat: 15.0, lng: 71.0 })).toBeNull();
  });
});

describe("addressAt — the address said back", () => {
  const place = readNominatimResponse({
    display_name: "Talwandi, Kota, Ladpura Tehsil, Kota, Rajasthan, 324001, India",
    address: { suburb: "Talwandi", city: "Kota", state_district: "Kota", state: "Rajasthan", postcode: "324001", country_code: "in" },
  });

  it("keeps the map's words once each, puts India Post's PIN in place of the map's, and drops the country", () => {
    expect(addressAt(place, "324005")).toBe("Talwandi, Kota, Ladpura Tehsil, Rajasthan 324005");
  });

  it("names the PIN's own area, district and state when the map could not answer", () => {
    expect(addressAt(null, "325601")).toMatch(/Kota, Rajasthan 325601$/);
  });

  it("is empty with nothing to say", () => {
    expect(addressAt(null, null)).toBe("");
  });
});

describe("searchAddresses — a suggestion carries India Post's PIN", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearSearchCache();
  });

  it("replaces the map's PIN in the suggestion — Photon offered Borkhera 324001, the pin there is 324002", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          features: [
            {
              geometry: { coordinates: [75.8784, 25.1957] },
              properties: { name: "PHC", street: "Baran Road", locality: "Borkhera", city: "Kota", state: "Rajasthan", postcode: "324001", countrycode: "IN" },
            },
          ],
        }),
      })),
    );
    const [found] = await searchAddresses("borkhera kota");
    expect(found.postalCode).toBe("324002");
    expect(found.label).toBe("PHC, Baran Road, Borkhera, Kota, Rajasthan 324002");
    expect(found.label).not.toContain("324001");
  });
});
