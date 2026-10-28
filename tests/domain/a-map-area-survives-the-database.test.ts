import { describe, expect, it } from "vitest";

import { DeliveryZoneModel } from "@/lib/server/db/models/delivery-zone.model";

/**
 * A MAP AREA SURVIVES THE DATABASE.
 *
 * The schema is strict: a field it does not name is dropped on save, with no
 * error — the owner draws an area, sees "Delivery zone updated", and the zone
 * comes back with no area and delivers nowhere. Cast here exactly as a save
 * casts it, without a database.
 */
describe("a zone's map area", () => {
  it("keeps a circle's centre and a boundary's corners, and nothing it does not know", () => {
    const circle = new DeliveryZoneModel({
      _id: "z1",
      name: "Sangod",
      coverage: "radius",
      center: { lat: 24.9227, lng: 76.2869, extra: "dropped" },
      radiusKm: 6,
    }).toJSON() as Record<string, unknown>;
    expect(circle.center).toEqual({ lat: 24.9227, lng: 76.2869 });
    expect(circle.radiusKm).toBe(6);
    expect(circle.coverage).toBe("radius");

    const drawn = new DeliveryZoneModel({
      _id: "z2",
      name: "Drawn",
      coverage: "polygon",
      polygon: [
        { lat: 24.93, lng: 76.27 },
        { lat: 24.94, lng: 76.3 },
        { lat: 24.91, lng: 76.31 },
      ],
    }).toJSON() as Record<string, unknown>;
    expect(drawn.polygon).toEqual([
      { lat: 24.93, lng: 76.27 },
      { lat: 24.94, lng: 76.3 },
      { lat: 24.91, lng: 76.31 },
    ]);
  });

  it("refuses a coverage the app does not know", () => {
    const zone = new DeliveryZoneModel({ _id: "z3", name: "X", coverage: "hexagon" });
    expect(zone.validateSync()?.errors.coverage).toBeDefined();
  });
});
