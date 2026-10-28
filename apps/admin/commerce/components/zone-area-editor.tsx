"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { Crosshair, Loader2, RotateCw, Trash2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { findPlace, PlaceSearch } from "@/components/shared/place-search";
import { addMapControls, boundsOf, drawZoneShapes, handleIcon, loadLeaflet, pinIcon } from "@/lib/leaflet-map";
import {
  distanceKm,
  formatLatLng,
  hasUsableArea,
  isAreaZone,
  isValidLatLng,
  MAX_RADIUS_KM,
  readPolygonText,
  isUsableShape,
  shapeMiddle,
  zoneShapes,
} from "@/features/commerce/lib/delivery-area";
import type { DeliveryZone, LatLng, ZoneArea } from "@/types/delivery";

/**
 * WHERE A ZONE DELIVERS, DRAWN ON THE MAP — free, on OpenStreetMap.
 *
 * A circle: tap the map to put its centre (usually the shop), drag the centre
 * pin to move it, drag the round handle on its edge to change how far it
 * reaches — or type the numbers. A boundary: tap the map at each corner, in
 * order around the area; drag a corner to move it.
 *
 * The typed boxes always work too: an owner can paste coordinates copied from
 * any map, and the form saves exactly what is in them.
 */

interface ZoneAreaEditorProps {
  kind: "radius" | "polygon";
  center?: LatLng;
  radiusKm: number;
  polygon?: LatLng[];
  /** The shop's other areas, drawn faintly so overlaps can be seen. */
  others: DeliveryZone[];
  /**
   * Where to open the map when this zone has no area yet — a place to SEARCH
   * for ("Sangod, Kota, Rajasthan"): the old PIN's town, or the shop's address.
   * Without it the map opened on all of India, and an owner's first tap put
   * the centre in Madhya Pradesh.
   */
  startHint?: string;
  /** The zone's OTHER areas, drawn dashed in its colour while this one is edited. */
  siblings?: ZoneArea[];
  /** Changes when a different area is picked to edit — the map then moves to it. */
  focusKey?: string | number;
  onChange: (patch: { center?: LatLng; radiusKm?: number; polygon?: LatLng[] }) => void;
}

/** A circle new to the map starts here, so it can be seen and dragged — never at 0 km. */
const STARTING_KM = 5;
/** Closer than this, a tap is a place; further out it is a region, and the map zooms in first. */
const PLACING_ZOOM = 11;
/** Six places is ~10 cm — a tap does not need fifteen. */
const round6 = (point: LatLng): LatLng => ({ lat: Math.round(point.lat * 1e6) / 1e6, lng: Math.round(point.lng * 1e6) / 1e6 });

const INDIA: LatLng = { lat: 22.97, lng: 78.65 };
const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const GREEN = "#15803d";

function middleOf(points: LatLng[]): LatLng {
  return {
    lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
    lng: points.reduce((sum, p) => sum + p.lng, 0) / points.length,
  };
}

/** The point `km` due east of `center` — where the circle's edge handle sits. */
function eastOf(center: LatLng, km: number): LatLng {
  const kmPerLng = 111.32 * Math.cos((center.lat * Math.PI) / 180);
  return { lat: center.lat, lng: center.lng + km / Math.max(kmPerLng, 1e-6) };
}

export function ZoneAreaEditor({
  kind,
  center,
  radiusKm,
  polygon,
  others,
  startHint,
  siblings = [],
  focusKey,
  onChange,
}: ZoneAreaEditorProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leaflet = useRef<{ L: typeof Leaflet; map: Leaflet.Map; mine: Leaflet.LayerGroup } | null>(null);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [locating, setLocating] = useState(false);
  const [zoomHint, setZoomHint] = useState(false);
  const latest = useRef({ kind, onChange, polygon, radiusKm });
  useEffect(() => {
    latest.current = { kind, onChange, polygon, radiusKm };
  }, [kind, onChange, polygon, radiusKm]);

  /** Puts the circle's centre here — at a size that can be seen — and brings the map close. */
  function centreAt(point: LatLng) {
    const at = round6(point);
    const { onChange: change, radiusKm: km } = latest.current;
    change({ center: at, ...(km > 0 ? {} : { radiusKm: STARTING_KM }) });
    const map = leaflet.current?.map;
    if (map && map.getZoom() < 12) map.setView(at, 13, { animate: false });
  }

  /** A place found by search or by the device: the centre, or — for a boundary — where to start drawing. */
  function goTo(point: LatLng) {
    setZoomHint(false);
    if (latest.current.kind === "radius") centreAt(point);
    else leaflet.current?.map.setView(point, 15, { animate: false });
  }

  function locateMe() {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        goTo({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  // What the corners box says, kept as typed so a half-written line survives;
  // corners that arrive from the map or the saved zone are shown instead.
  const [cornersText, setCornersText] = useState(() => (polygon ?? []).map(formatLatLng).join("\n"));
  const want = polygon ?? [];
  const typed = readPolygonText(cornersText).points;
  const typedIsCurrent =
    want.length === typed.length &&
    want.every((point, i) => same(point.lat, typed[i].lat) && same(point.lng, typed[i].lng));
  const shownCorners = typedIsCurrent ? cornersText : want.map(formatLatLng).join("\n");
  const corners = readPolygonText(shownCorners);

  /* The map, once per open. */
  useEffect(() => {
    if (!mapRef.current) return;
    let alive = true;
    let built: Leaflet.Map | null = null;
    // A dialog that animates open, a phone turned sideways: Leaflet measures
    // its box once, and draws grey where the box later grew. Told every time.
    let resized: ResizeObserver | null = null;
    void loadLeaflet()
      .then((L) => {
        if (!alive || !mapRef.current) return;
        const start =
          (center && isValidLatLng(center) ? center : null) ?? ((polygon?.length ?? 0) >= 3 ? middleOf(polygon!) : null);
        const otherArea = others.find((zone) => zone.isActive && isAreaZone(zone) && hasUsableArea(zone));
        const nearby = otherArea ? shapeMiddle(zoneShapes(otherArea)[0]) : null;
        const map = L.map(mapRef.current).setView(start ?? nearby ?? INDIA, start || nearby ? 12 : 5);

        built = map;
        resized = new ResizeObserver(() => map.invalidateSize());
        resized.observe(mapRef.current);
        const mine = L.layerGroup().addTo(map);
        const neighbours = L.layerGroup().addTo(map);
        // "Show this zone" frames what is being drawn — or, before anything is, the shop's other areas.
        addMapControls(L, map, {
          fitAll: () => boundsOf(L, mine.getLayers()) ?? boundsOf(L, neighbours.getLayers()),
          fitLabel: "Show this zone",
        });

        const faint = { color: "#64748b", weight: 1.5, opacity: 0.8, fillOpacity: 0.08, interactive: false };
        for (const zone of others) {
          if (!zone.isActive || !isAreaZone(zone) || !hasUsableArea(zone)) continue;
          // The others named too, faintly — "is this overlapping Talwandi?" is the question.
          for (const shape of drawZoneShapes(L, zone, faint, neighbours)) {
            shape.bindTooltip(zone.name, { permanent: true, direction: "center", className: "zone-label zone-label-faint" });
          }
        }

        map.on("click", (event: Leaflet.LeafletMouseEvent) => {
          const at = round6({ lat: event.latlng.lat, lng: event.latlng.lng });
          // Seen from this far out, a tap is a whole district: come closer first.
          if (map.getZoom() < PLACING_ZOOM) {
            map.setView(at, 13, { animate: false });
            setZoomHint(true);
            return;
          }
          setZoomHint(false);
          if (latest.current.kind === "radius") centreAt(at);
          else latest.current.onChange({ polygon: [...(latest.current.polygon ?? []), at] });
        });

        leaflet.current = { L, map, mine };
        setReady(true);
        setMapError(null);
      })
      .catch((error: unknown) => {
        if (alive) setMapError(error instanceof Error ? error.message : "The map could not load.");
      });
    return () => {
      alive = false;
      resized?.disconnect();
      built?.remove();
      leaflet.current = null;
      setReady(false);
    };
    // Built once per open; this zone's shapes are redrawn by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry]);

  /*
    No area of its own and none nearby: open on the place the zone is about,
    found by name. Its own effect, because the hint can arrive after the map —
    the old PIN's town is looked up while Leaflet loads.
  */
  useEffect(() => {
    const map = leaflet.current?.map;
    if (!ready || !map || !startHint || map.getZoom() > 5) return;
    let alive = true;
    void findPlace(startHint)
      .then((place) => {
        if (alive && place && map.getZoom() <= 5) map.setView(place.location, 12, { animate: false });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [ready, startHint]);

  /* This zone's shape, redrawn from the form whenever it changes — typed numbers move it too. */
  useEffect(() => {
    const current = leaflet.current;
    if (!ready || !current) return;
    const { L, mine } = current;
    mine.clearLayers();
    // The zone's other areas, so the owner sees the whole zone while editing one part.
    for (const sibling of siblings.filter(isUsableShape)) {
      const dashed = { color: GREEN, weight: 1.5, dashArray: "5 5", fillOpacity: 0.06, interactive: false };
      if (sibling.kind === "radius") L.circle(sibling.center, { ...dashed, radius: sibling.radiusKm * 1000 }).addTo(mine);
      else L.polygon(sibling.polygon, dashed).addTo(mine);
    }
    const style = { color: GREEN, weight: 2, fillOpacity: 0.15 };

    if (kind === "radius" && center && isValidLatLng(center)) {
      const circle = L.circle(center, { ...style, radius: Math.max(radiusKm, 0.05) * 1000, interactive: false }).addTo(mine);
      const middle = L.marker(center, { draggable: true, icon: pinIcon(L, GREEN), title: "Centre — drag to move" }).addTo(mine);
      middle.on("drag", () => circle.setLatLng(middle.getLatLng()));
      middle.on("dragend", () => {
        const at = middle.getLatLng();
        onChange({ center: round6({ lat: at.lat, lng: at.lng }) });
      });
      const edge = L.marker(eastOf(center, Math.max(radiusKm, 0.05)), {
        draggable: true,
        icon: handleIcon(L),
        title: "Edge — drag to change how far",
      }).addTo(mine);
      const kmTo = () => Math.round(distanceKm(center, edge.getLatLng()) * 100) / 100;
      edge.on("drag", () => circle.setRadius(kmTo() * 1000));
      edge.on("dragend", () => onChange({ radiusKm: Math.min(kmTo(), MAX_RADIUS_KM) }));
    }

    if (kind === "polygon" && want.length > 0) {
      if (want.length >= 3) L.polygon(want, { ...style, interactive: false }).addTo(mine);
      else L.polyline(want, { color: GREEN, weight: 2, dashArray: "4 4", interactive: false }).addTo(mine);
      want.forEach((point, i) => {
        const corner = L.marker(point, { draggable: true, icon: handleIcon(L), title: `Corner ${i + 1} — drag to move` }).addTo(mine);
        corner.on("dragend", () => {
          const at = corner.getLatLng();
          const next = want.map((p, j) => (j === i ? round6({ lat: at.lat, lng: at.lng }) : p));
          onChange({ polygon: next });
        });
      });
    }
    // `want` is `polygon ?? []`; the polygon itself is the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, kind, center?.lat, center?.lng, radiusKm, polygon, siblings]);

  /* A different area picked to edit: bring the map to it, if it has a place yet. */
  useEffect(() => {
    const map = leaflet.current?.map;
    if (!ready || !map || focusKey === undefined) return;
    const shape: ZoneArea | null =
      kind === "radius" && center && isValidLatLng(center)
        ? { kind: "radius", center, radiusKm: Math.max(radiusKm, 0.05) }
        : kind === "polygon" && (polygon?.length ?? 0) > 0
          ? { kind: "polygon", polygon: polygon! }
          : null;
    if (!shape) return;
    const L = leaflet.current!.L;
    const bounds =
      shape.kind === "radius" ? L.latLng(shape.center).toBounds(shape.radiusKm * 2000) : L.latLngBounds(shape.polygon);
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16, animate: false });
    // Only a new pick moves the map — not every drag of the area being edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, focusKey]);

  function undoCorner() {
    const points = want.slice(0, -1);
    setCornersText(points.map(formatLatLng).join("\n"));
    onChange({ polygon: points });
  }

  function clearCorners() {
    setCornersText("");
    onChange({ polygon: [] });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <PlaceSearch
          className="flex-1"
          onPick={(place) => goTo(place.location)}
          near={center ?? null}
          placeholder={kind === "radius" ? "Find your shop or area" : "Find the area to draw around"}
        />
        <Button type="button" variant="outline" className="h-11" onClick={locateMe} disabled={locating || !ready}>
          {locating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Crosshair className="size-4" aria-hidden />}
          {kind === "radius" ? "I am at the shop" : "Use my location"}
        </Button>
      </div>
      {zoomHint ? (
        <p role="status" className="text-xs font-medium text-amber-700 dark:text-amber-300">
          Zoomed in — now tap the exact spot{kind === "radius" ? " of your shop" : " of the first corner"}.
        </p>
      ) : null}
      {/* Leaflet sets z-indexes up to 1000 inside; `isolate` keeps them under the dialog's own layers. */}
      <div className="relative isolate overflow-hidden rounded-lg border border-border">
        <div ref={mapRef} className="h-72 w-full bg-muted" aria-label="Map of this zone's area" />
        {!ready && !mapError ? (
          <div className="absolute inset-0 z-[1001] flex items-center justify-center gap-2 bg-muted text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Loading map…
          </div>
        ) : null}
        {mapError ? (
          <div className="absolute inset-0 z-[1001] flex flex-col items-center justify-center gap-2 bg-muted p-4 text-center text-sm">
            <p>{mapError}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => setRetry((n) => n + 1)}>
              <RotateCw className="size-4" aria-hidden /> Try again
            </Button>
          </div>
        ) : null}
      </div>

      {kind === "radius" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="zone-center-lat">Centre latitude</Label>
            <Input
              id="zone-center-lat"
              inputMode="decimal"
              value={center ? String(center.lat) : ""}
              onChange={(event) => onChange({ center: { lat: Number(event.target.value), lng: center?.lng ?? 0 } })}
              placeholder="24.9227"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zone-center-lng">Centre longitude</Label>
            <Input
              id="zone-center-lng"
              inputMode="decimal"
              value={center ? String(center.lng) : ""}
              onChange={(event) => onChange({ center: { lat: center?.lat ?? 0, lng: Number(event.target.value) } })}
              placeholder="76.2869"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zone-radius">Reaches (km)</Label>
            <Input
              id="zone-radius"
              type="number"
              min={0}
              max={MAX_RADIUS_KM}
              step={0.5}
              value={radiusKm || ""}
              onChange={(event) => onChange({ radiusKm: Math.max(0, Number(event.target.value) || 0) })}
              placeholder="8"
            />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-3">
            Tap the map to put the centre — usually your shop — then drag the round handle on the circle&apos;s edge to set
            how far you go. Distance is measured in a straight line, not by road.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="zone-corners">Boundary corners</Label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={undoCorner} disabled={!want.length}>
                <Undo2 className="size-4" aria-hidden /> Undo corner
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={clearCorners} disabled={!want.length}>
                <Trash2 className="size-4" aria-hidden /> Clear
              </Button>
            </div>
          </div>
          <Textarea
            id="zone-corners"
            rows={4}
            value={shownCorners}
            onChange={(event) => {
              setCornersText(event.target.value);
              onChange({ polygon: readPolygonText(event.target.value).points });
            }}
            placeholder={"24.9310, 76.2700\n24.9400, 76.3000\n24.9100, 76.3100"}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Tap the map at each corner, in order around the area; drag a corner to move it. Or type one
            &quot;latitude, longitude&quot; per line. {corners.points.length} corner
            {corners.points.length === 1 ? "" : "s"}
            {corners.bad.length ? ` — not read: ${corners.bad.slice(0, 2).join("; ")}` : ""}.
          </p>
        </div>
      )}
    </div>
  );
}
