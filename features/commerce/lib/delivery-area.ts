import type { DeliveryZone, DeliveryZoneMatch, LatLng, ZoneArea } from "@/types/delivery";
import { matchStateName } from "./india-states";

/**
 * WHICH DELIVERY AREA HOLDS A POINT ON THE MAP.
 *
 * The owner's rule (2026-10-27): the customer's pin decides delivery, never
 * the PIN code they typed. A zone is a circle (`radius`: a centre and km) or
 * a boundary drawn on the map (`polygon`). Pure, so the browser's running
 * total and the server's refusal give the same answer from the same zones —
 * the server's is the one that counts.
 */

/** Mean Earth radius, km. */
const EARTH_KM = 6371.0088;

/** Most corners a drawn boundary may have — a street-by-street outline, not a coastline. */
export const MAX_POLYGON_POINTS = 500;
/** Most circles and boundaries one zone may hold — a town of mohallas, not a country. */
export const MAX_AREAS_PER_ZONE = 50;
/** Widest circle a zone may have. Further than this is a courier, not a bakery van. */
export const MAX_RADIUS_KM = 300;

/**
 * A real point: finite, in range, and not 0,0.
 *
 * 0,0 is in the Gulf of Guinea, and it is what a missing coordinate becomes
 * when something writes `Number(undefined) || 0` — so it is refused rather
 * than tested against the zones.
 */
export function isValidLatLng(point: unknown): point is LatLng {
  if (!point || typeof point !== "object") return false;
  const { lat, lng } = point as Record<string, unknown>;
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return !(lat === 0 && lng === 0);
}

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in km (haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** About a millimetre, in degrees: closer than this to an edge is ON it. */
const ON_EDGE = 1e-8;

function onSegment(p: LatLng, a: LatLng, b: LatLng): boolean {
  const cross = (p.lng - a.lng) * (b.lat - a.lat) - (p.lat - a.lat) * (b.lng - a.lng);
  const length = Math.hypot(b.lat - a.lat, b.lng - a.lng);
  if (length === 0) return Math.hypot(p.lat - a.lat, p.lng - a.lng) <= ON_EDGE;
  if (Math.abs(cross) / length > ON_EDGE) return false;
  const dot = (p.lng - a.lng) * (b.lng - a.lng) + (p.lat - a.lat) * (b.lat - a.lat);
  return dot >= -ON_EDGE && dot <= length * length + ON_EDGE;
}

/**
 * Whether a point is inside a boundary — or on it, which counts as inside: a
 * door on the line the owner drew is a door they meant to reach.
 *
 * Ray casting on the lat/lng plane. A delivery area is a few km across, where
 * that plane is as good as the sphere; an area crossing the 180th meridian is
 * not one an Indian bakery draws.
 */
export function pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (onSegment(point, a, b)) return true;
    const crosses =
      a.lat > point.lat !== b.lat > point.lat &&
      point.lng < ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng;
    if (crosses) inside = !inside;
  }
  return inside;
}

/**
 * Whether a boundary crosses itself — corners tapped out of order make a
 * bow-tie, and a bow-tie's two lobes are inside while the middle of the area
 * the owner meant may not be. Two edges that share a corner do not count.
 */
export function polygonCrossesItself(points: LatLng[]): boolean {
  const n = points.length;
  if (n < 4) return false;
  const turn = (a: LatLng, b: LatLng, c: LatLng) => Math.sign((b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng));
  for (let i = 0; i < n; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % n];
    for (let j = i + 1; j < n; j += 1) {
      // Neighbouring edges meet at a corner; that is not a crossing.
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      const c = points[j];
      const d = points[(j + 1) % n];
      if (turn(a, b, c) * turn(a, b, d) < 0 && turn(c, d, a) * turn(c, d, b) < 0) return true;
    }
  }
  return false;
}

/** A zone drawn on the map — one circle, one boundary, or several — as opposed to one written as PINs or names. */
export function isAreaZone(zone: Pick<DeliveryZone, "coverage">): boolean {
  return zone.coverage === "radius" || zone.coverage === "polygon" || zone.coverage === "areas";
}

/**
 * EVERY SHAPE A ZONE COVERS, whatever way it was saved: a zone of one circle
 * (`radius`), of one boundary (`polygon`), or of several (`areas`). Every
 * question about a zone's area is asked of these, so the three are one thing.
 */
export function zoneShapes(zone: Pick<DeliveryZone, "coverage" | "center" | "radiusKm" | "polygon" | "areas">): ZoneArea[] {
  if (zone.coverage === "radius") return zone.center ? [{ kind: "radius", center: zone.center, radiusKm: zone.radiusKm }] : [];
  if (zone.coverage === "polygon") return [{ kind: "polygon", polygon: zone.polygon ?? [] }];
  if (zone.coverage === "areas") return zone.areas ?? [];
  return [];
}

/** Whether one shape is usable: a real centre and radius, or three to 500 real corners. */
export function isUsableShape(shape: ZoneArea): boolean {
  if (shape.kind === "radius") {
    return isValidLatLng(shape.center) && shape.radiusKm > 0 && shape.radiusKm <= MAX_RADIUS_KM;
  }
  const points = shape.polygon ?? [];
  return points.length >= 3 && points.length <= MAX_POLYGON_POINTS && points.every(isValidLatLng);
}

/** Whether the zone's area is usable: at least one shape, and every shape a real one. */
export function hasUsableArea(zone: DeliveryZone): boolean {
  const shapes = zoneShapes(zone);
  return shapes.length > 0 && shapes.every(isUsableShape);
}

/** Whether one shape holds the point — on its edge counts as inside. */
export function shapeContainsPoint(shape: ZoneArea, point: LatLng): boolean {
  if (!isUsableShape(shape) || !isValidLatLng(point)) return false;
  // A millimetre of slack, so a pin exactly on the circle is inside it.
  if (shape.kind === "radius") return distanceKm(shape.center, point) <= shape.radiusKm + 1e-6;
  return pointInPolygon(point, shape.polygon);
}

/** Whether the zone's area holds the point. Not whether the zone is switched on. */
export function zoneContainsPoint(zone: DeliveryZone, point: LatLng): boolean {
  return hasUsableArea(zone) && zoneShapes(zone).some((shape) => shapeContainsPoint(shape, point));
}

/** How far a point is from one shape's edge, km — 0 inside it. */
export function kmToShape(shape: ZoneArea, point: LatLng): number {
  if (!isUsableShape(shape) || !isValidLatLng(point)) return Number.POSITIVE_INFINITY;
  if (shape.kind === "radius") return Math.max(0, distanceKm(shape.center, point) - shape.radiusKm);
  if (pointInPolygon(point, shape.polygon)) return 0;
  // Flat within a town's width: km east and north of the point, then the nearest side.
  const kmPerLat = (Math.PI * EARTH_KM) / 180;
  const kmPerLng = kmPerLat * Math.cos(radians(point.lat));
  const xy = (p: LatLng) => ({ x: (p.lng - point.lng) * kmPerLng, y: (p.lat - point.lat) * kmPerLat });
  let nearest = Number.POSITIVE_INFINITY;
  const corners = shape.polygon.map(xy);
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i, i += 1) {
    const a = corners[j];
    const b = corners[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = dx || dy ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / (dx * dx + dy * dy))) : 0;
    nearest = Math.min(nearest, Math.hypot(a.x + t * dx, a.y + t * dy));
  }
  return nearest;
}

/**
 * How far a point is from the nearest live area drawn on the map, km — so a
 * customer told "outside our delivery area" also learns whether that is the
 * next street or the next town. Infinity with no live drawn area.
 */
export function kmToNearestArea(zones: DeliveryZone[], point: LatLng): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (const zone of zones) {
    if (!zone.isActive || !isAreaZone(zone) || !hasUsableArea(zone)) continue;
    for (const shape of zoneShapes(zone)) nearest = Math.min(nearest, kmToShape(shape, point));
  }
  return nearest;
}

/** Roughly how big one shape is, km². */
export function shapeAreaKm2(shape: ZoneArea): number {
  if (!isUsableShape(shape)) return Number.POSITIVE_INFINITY;
  if (shape.kind === "radius") return Math.PI * shape.radiusKm ** 2;
  const points = shape.polygon;
  const meanLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const kmPerLat = (Math.PI * EARTH_KM) / 180;
  const kmPerLng = kmPerLat * Math.cos(radians(meanLat));
  let twice = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    twice += points[j].lng * kmPerLng * (points[i].lat * kmPerLat) - points[i].lng * kmPerLng * (points[j].lat * kmPerLat);
  }
  return Math.abs(twice) / 2;
}

/**
 * How big the zone's area is where it holds the point, km² — the smallest of
 * its shapes that does. A zone of three small mohallas is as narrow as one of
 * them, not as wide as the three together.
 */
export function zoneAreaKm2(zone: DeliveryZone, point?: LatLng): number {
  if (!hasUsableArea(zone)) return Number.POSITIVE_INFINITY;
  const shapes = zoneShapes(zone).filter((shape) => !point || shapeContainsPoint(shape, point));
  return shapes.length ? Math.min(...shapes.map(shapeAreaKm2)) : Number.POSITIVE_INFINITY;
}

/**
 * Every active area zone that holds the point, the winner first.
 *
 * Narrowest first, as with PIN rules: a 3 km "near the shop" circle inside a
 * 10 km "whole town" one is the zone the owner drew for that street. Then the
 * owner's priority, then the cheaper charge, then the id — so the browser and
 * the server, which list zones in different orders, name the same winner.
 */
export function rankAreaZones(zones: DeliveryZone[], point: LatLng): DeliveryZoneMatch[] {
  if (!isValidLatLng(point)) return [];
  return zones
    .filter((zone) => zone.isActive && isAreaZone(zone) && zoneContainsPoint(zone, point))
    .map((zone) => ({ zone, area: zoneAreaKm2(zone, point) }))
    .sort(
      (a, b) =>
        a.area - b.area ||
        b.zone.priority - a.zone.priority ||
        a.zone.deliveryCharge - b.zone.deliveryCharge ||
        a.zone.id.localeCompare(b.zone.id),
    )
    .map(({ zone }) => ({ zone, matchType: "area" as const }));
}

export function findAreaZone(zones: DeliveryZone[], point: LatLng): DeliveryZoneMatch | null {
  return rankAreaZones(zones, point)[0] ?? null;
}

/** Points that stand for a shape when asking whether two touch: its corners, or its centre and rim. */
function samplePoints(shape: ZoneArea): LatLng[] {
  if (shape.kind === "polygon") return shape.polygon;
  const { center, radiusKm } = shape;
  const kmPerLat = (Math.PI * EARTH_KM) / 180;
  const dLat = radiusKm / kmPerLat;
  const dLng = radiusKm / (kmPerLat * Math.cos(radians(center.lat)));
  const rim = Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 16) * 2 * Math.PI;
    return { lat: center.lat + dLat * Math.sin(angle), lng: center.lng + dLng * Math.cos(angle) };
  });
  return [center, ...rim];
}

/**
 * Whether two shapes overlap — near enough, for a warning in the form: one's
 * corners (or a circle's centre and rim) inside the other, either way round.
 * Two circles are answered exactly.
 */
export function shapesTouch(a: ZoneArea, b: ZoneArea): boolean {
  if (!isUsableShape(a) || !isUsableShape(b)) return false;
  if (a.kind === "radius" && b.kind === "radius") return distanceKm(a.center, b.center) < a.radiusKm + b.radiusKm;
  return samplePoints(a).some((point) => shapeContainsPoint(b, point)) || samplePoints(b).some((point) => shapeContainsPoint(a, point));
}

/** Whether any shape of one zone overlaps any shape of the other. */
export function areasTouch(a: DeliveryZone, b: DeliveryZone): boolean {
  if (!hasUsableArea(a) || !hasUsableArea(b)) return false;
  return zoneShapes(a).some((one) => zoneShapes(b).some((other) => shapesTouch(one, other)));
}

/** The middle of a shape — a circle's centre, a boundary's mean corner — for opening a map on it. */
export function shapeMiddle(shape: ZoneArea): LatLng {
  if (shape.kind === "radius") return shape.center;
  return {
    lat: shape.polygon.reduce((sum, p) => sum + p.lat, 0) / shape.polygon.length,
    lng: shape.polygon.reduce((sum, p) => sum + p.lng, 0) / shape.polygon.length,
  };
}

/**
 * WHERE A PIN IS, AS A PLACE NAME — the state, and the district(s) as India
 * Post spells them. Worked out on the server from the map (and, when the map
 * cannot say, from the address's PIN); a browser previews it from the PIN.
 */
export interface PinRegion {
  state: string | null;
  districts: string[];
}

/** A whole-district or whole-state zone, decided by where the pin is. */
export function isRegionZone(zone: Pick<DeliveryZone, "coverage">): boolean {
  return zone.coverage === "cities" || zone.coverage === "states";
}

/**
 * Whether the zone can make an address deliverable: a map area, or a whole
 * district or state (owner, 2026-10-27). PIN-code and all-of-India zones
 * cannot — a PIN proves nothing about where the cake goes.
 */
export function decidesDelivery(zone: Pick<DeliveryZone, "coverage">): boolean {
  return isAreaZone(zone) || isRegionZone(zone);
}

/** Whether any live zone needs the pin's district or state to answer. */
export function hasActiveRegionZones(zones: DeliveryZone[]): boolean {
  return zones.some((zone) => zone.isActive && isRegionZone(zone));
}

const foldName = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");

const byTieBreak = (a: DeliveryZone, b: DeliveryZone) =>
  b.priority - a.priority || a.deliveryCharge - b.deliveryCharge || a.id.localeCompare(b.id);

/**
 * THE ZONE FOR A PIN — the narrowest that holds it.
 *
 * A circle or boundary drawn on the map first; then a whole district; then a
 * whole state — the same "narrower wins" the PIN zones always followed, so a
 * ₹40 Kota-town circle beats the ₹150 all-Rajasthan zone around it. The
 * district and state are the pin's own (`region`); without one, only drawn
 * areas can answer.
 */
export function findDeliveryZoneForPin(
  zones: DeliveryZone[],
  point: LatLng,
  region?: PinRegion | null,
): DeliveryZoneMatch | null {
  const area = findAreaZone(zones, point);
  if (area || !region || !isValidLatLng(point)) return area;
  return findRegionZone(zones, region);
}

/**
 * The whole-district or whole-state zone for a place — the district first,
 * then the state. What a PIN alone can answer: its district and state are
 * India Post's, so "is 324005 delivered?" has a real answer when the shop
 * covers districts or states, and only a drawn area needs the door itself.
 */
export function findRegionZone(zones: DeliveryZone[], region: PinRegion): DeliveryZoneMatch | null {
  const live = zones.filter((zone) => zone.isActive);
  const districts = region.districts.map(foldName);
  const inDistrict = live
    .filter((zone) => zone.coverage === "cities" && (zone.cities ?? []).some((name) => districts.includes(foldName(name))))
    .sort(byTieBreak)[0];
  if (inDistrict) return { zone: inDistrict, matchType: "city" };

  const state = region.state ? matchStateName(region.state) : null;
  const inState = state
    ? live.filter((zone) => zone.coverage === "states" && (zone.states ?? []).some((name) => matchStateName(name) === state)).sort(byTieBreak)[0]
    : undefined;
  return inState ? { zone: inState, matchType: "state" } : null;
}

/** Whether the shop has drawn any area it delivers to. */
export function hasActiveAreaZones(zones: DeliveryZone[]): boolean {
  return zones.some((zone) => zone.isActive && isAreaZone(zone) && hasUsableArea(zone));
}

/**
 * Corners typed or pasted as "lat, lng" — one per line — for an owner without
 * the map, or one copying a boundary from elsewhere. Returns the points and the
 * lines that were not a point, so the form can say which.
 */
export function readPolygonText(text: string): { points: LatLng[]; bad: string[] } {
  const points: LatLng[] = [];
  const bad: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
    const point = match ? { lat: Number(match[1]), lng: Number(match[2]) } : null;
    if (point && isValidLatLng(point)) points.push(point);
    else bad.push(line);
  }
  return { points, bad };
}

/** "25.1234, 76.5678" — six places is ~10 cm, more than a door needs. */
export function formatLatLng(point: LatLng): string {
  return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
}

/** A link that opens the point in Google Maps, for the admin and the rider. */
export function mapsLinkFor(point: LatLng): string {
  return `https://www.google.com/maps/search/?api=1&query=${point.lat.toFixed(6)}%2C${point.lng.toFixed(6)}`;
}
