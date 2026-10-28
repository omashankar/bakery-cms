import { describe, expect, it } from "vitest";

import type { DeliveryZone, LatLng, ZoneArea } from "@/types/delivery";
import { areasTouch, findAreaZone, hasUsableArea, zoneContainsPoint, zoneShapes } from "@/features/commerce/lib/delivery-area";
import { checkZoneDraft } from "@/features/commerce/lib/delivery-zone-validation";
import { describeZoneCoverage } from "@/features/commerce/lib/delivery-zone-utils";
import { deliveryZonesArraySchema } from "@/features/commerce/server/commerce.validators";
import { DeliveryZoneModel } from "@/lib/server/db/models/delivery-zone.model";

/**
 * ONE ZONE CAN HOLD SEVERAL AREAS.
 *
 * The owner asked (2026-10-27) to choose "selected areas": Talwandi, Mahaveer
 * Nagar and Vigyan Nagar at ₹40 were three zones with the same charge and days
 * typed three times. Now one zone holds several circles and boundaries.
 */

const TALWANDI: LatLng = { lat: 25.1415, lng: 75.8475 };
const VIGYAN: LatLng = { lat: 25.137, lng: 75.82 };
const BETWEEN: LatLng = { lat: 25.139, lng: 75.834 }; // in neither circle
const square = (lat: number, lng: number, d = 0.01) => [
  { lat, lng },
  { lat, lng: lng + d },
  { lat: lat + d, lng: lng + d },
  { lat: lat + d, lng },
];

const base = { city: "", pincode: "", radiusKm: 0, minDeliveryDays: 0, estimatedDeliveryDays: 1, isActive: true, priority: 50, createdAt: "", updatedAt: "" };
const areas: ZoneArea[] = [
  { kind: "radius", center: TALWANDI, radiusKm: 0.8 },
  { kind: "radius", center: VIGYAN, radiusKm: 0.8 },
  { kind: "polygon", polygon: square(25.18, 75.87) },
];
const forty: DeliveryZone = { ...base, id: "forty", name: "₹40 areas", coverage: "areas", areas, deliveryCharge: 40 };

describe("a zone of several areas", () => {
  it("holds a pin in any of them, and not one between them", () => {
    expect(zoneContainsPoint(forty, { lat: 25.1418, lng: 75.8478 })).toBe(true);
    expect(zoneContainsPoint(forty, { lat: 25.1372, lng: 75.8202 })).toBe(true);
    expect(zoneContainsPoint(forty, { lat: 25.185, lng: 75.875 })).toBe(true);
    expect(zoneContainsPoint(forty, BETWEEN)).toBe(false);
  });

  it("is as narrow as the area that holds the pin — not as wide as all of them together", () => {
    // A 1.2 km town circle round Talwandi (4.5 km²): smaller than the ₹40 zone's three
    // areas together (~5 km²), larger than its 0.8 km Talwandi circle (2 km²) — which is what counts.
    const town: DeliveryZone = { ...base, id: "town", name: "Town", coverage: "radius", center: TALWANDI, radiusKm: 1.2, deliveryCharge: 30 };
    expect(findAreaZone([town, forty], { lat: 25.1418, lng: 75.8478 })?.zone.id).toBe("forty");
  });

  it("reads the old one-circle and one-boundary zones as one area each", () => {
    const circle = { ...base, id: "c", name: "C", coverage: "radius" as const, center: TALWANDI, radiusKm: 1, deliveryCharge: 1 };
    expect(zoneShapes(circle)).toEqual([{ kind: "radius", center: TALWANDI, radiusKm: 1 }]);
    expect(hasUsableArea({ ...forty, areas: [] })).toBe(false);
    expect(hasUsableArea({ ...forty, areas: [...areas, { kind: "polygon", polygon: square(25, 75).slice(0, 2) }] })).toBe(false);
  });

  it("warns of an overlap with another zone through any of its areas", () => {
    const near: DeliveryZone = { ...base, id: "n", name: "Near Vigyan", coverage: "radius", center: { lat: 25.138, lng: 75.821 }, radiusKm: 0.5, deliveryCharge: 50 };
    expect(areasTouch(forty, near)).toBe(true);
  });

  it("is described by what it holds", () => {
    expect(describeZoneCoverage(forty).covers).toBe("3 map areas · 2 circles, 1 boundary");
    expect(describeZoneCoverage({ ...forty, areas: [areas[0]] }).covers).toMatch(/^0\.8 km around 25\.1415, 75\.8475$/);
  });
});

describe("saving a zone of several areas", () => {
  const draft = (zoneAreas: ZoneArea[]) =>
    checkZoneDraft({ zone: { ...base, name: "₹40", deliveryCharge: 40, coverage: "areas", areas: zoneAreas }, pincodeEntries: [], excludedEntries: [], others: [] });

  it("names which area is wrong", () => {
    const problems = draft([areas[0], { kind: "radius", center: TALWANDI, radiusKm: 0 }, { kind: "polygon", polygon: [square(25, 75)[0], square(25, 75)[2], square(25, 75)[1], square(25, 75)[3]] }]);
    expect(problems.missing).toContain("Area 2: Set how far it reaches, in km.");
    expect(problems.errors.join(" ")).toContain("Area 3: The boundary crosses itself");
  });

  it("asks for at least one area", () => {
    expect(draft([]).missing).toContain("Add at least one area: a circle or a boundary.");
    expect(draft(areas).missing).toEqual([]);
  });

  it("passes the server's check, and refuses an area that is not one", () => {
    expect(deliveryZonesArraySchema.safeParse([forty]).success).toBe(true);
    expect(deliveryZonesArraySchema.safeParse([{ ...forty, areas: [{ kind: "radius", center: TALWANDI, radiusKm: 0 }] }]).success).toBe(false);
    expect(deliveryZonesArraySchema.safeParse([{ ...forty, areas: [] }]).success).toBe(false);
  });

  it("survives the database: every area kept, nothing else", () => {
    const saved = new DeliveryZoneModel({ _id: "forty", name: "₹40", coverage: "areas", areas }).toJSON() as { areas: ZoneArea[] };
    expect(saved.areas).toEqual(areas);
  });
});
