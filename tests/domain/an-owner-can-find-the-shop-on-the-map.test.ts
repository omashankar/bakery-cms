import { describe, expect, it } from "vitest";

import { bestPlaceFor, placeQueries, type PlaceSuggestion } from "@/components/shared/place-search";
import { polygonCrossesItself } from "@/features/commerce/lib/delivery-area";
import { checkZoneDraft } from "@/features/commerce/lib/delivery-zone-validation";

/**
 * AN OWNER CAN FIND THE SHOP ON THE MAP, AND CANNOT SAVE A BROKEN AREA.
 *
 * Walked through as the owner (2026-10-27): the zone form opened on all of
 * India, the first tap put the centre in Madhya Pradesh, the shop's own
 * address found nothing, and corners tapped out of order saved a bow-tie.
 */

const place = (label: string, postalCode?: string): PlaceSuggestion => ({ label, postalCode, location: { lat: 25, lng: 76 } });

describe("opening the map on the shop's address", () => {
  it("tries ever-shorter forms of an address the search does not know", () => {
    expect(placeQueries("Santosh Nagar - 1, C-7, I, Borkhera, Kota, Rajasthan 324002")).toEqual([
      "Santosh Nagar - 1, C-7, I, Borkhera, Kota, Rajasthan 324002",
      "C-7, I, Borkhera, Kota, Rajasthan",
      "I, Borkhera, Kota, Rajasthan",
      "Borkhera, Kota, Rajasthan",
    ]);
  });

  it("picks the village in the address's own town — measured: Borkhera is in Kota and in Digod", () => {
    const answer = [
      place("Borkhera, Digod Tehsil, Rajasthan, 325204", "325204"),
      place("PHC, Borkhera, Baran Road, Kota, Rajasthan, 324001", "324001"),
    ];
    expect(bestPlaceFor("Santosh Nagar - 1, C-7, I, Borkhera, Kota, Rajasthan 324002", answer)?.postalCode).toBe("324001");
  });

  it("prefers the address's own PIN above all", () => {
    const answer = [place("Borkhera, Kota, Rajasthan", "324001"), place("Borkhera, Rajasthan", "324002")];
    expect(bestPlaceFor("Borkhera, Kota, Rajasthan 324002", answer)?.postalCode).toBe("324002");
  });
});

describe("a boundary that crosses itself", () => {
  const square = [
    { lat: 25, lng: 76 },
    { lat: 25, lng: 76.1 },
    { lat: 25.1, lng: 76.1 },
    { lat: 25.1, lng: 76 },
  ];
  // The same four corners, tapped across instead of round.
  const bowTie = [square[0], square[2], square[1], square[3]];

  it("is told apart from one drawn in order", () => {
    expect(polygonCrossesItself(square)).toBe(false);
    expect(polygonCrossesItself(bowTie)).toBe(true);
    expect(polygonCrossesItself(square.slice(0, 3))).toBe(false);
  });

  it("cannot be saved", () => {
    const base = { name: "Drawn", city: "", pincode: "", radiusKm: 0, deliveryCharge: 60, minDeliveryDays: 0, estimatedDeliveryDays: 1, isActive: true, priority: 50 };
    const check = (polygon: typeof square) =>
      checkZoneDraft({ zone: { ...base, coverage: "polygon", polygon }, pincodeEntries: [], excludedEntries: [], others: [] }).errors;
    expect(check(bowTie).join(" ")).toContain("crosses itself");
    expect(check(square)).toEqual([]);
  });
});
