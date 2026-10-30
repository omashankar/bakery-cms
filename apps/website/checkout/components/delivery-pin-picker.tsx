"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { AlertTriangle, CheckCircle2, Crosshair, Loader2, MapPin, RotateCw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PlaceSearch, type PlaceSuggestion } from "@/components/shared/place-search";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";
import { locateDevice } from "@/lib/device-location";
import { soonestDeliveryDays, soonestDeliveryText } from "@/features/commerce/lib/delivery-location";
import { addMapControls, boundsOf, drawZoneShapes, loadLeaflet, pinIcon } from "@/lib/leaflet-map";
import { loadDeliveryZones } from "@/features/commerce/lib/delivery-zones-repository";
import { formatLatLng, hasUsableArea, isAreaZone, isValidLatLng, shapeMiddle, zoneShapes, type PinRegion } from "@/features/commerce/lib/delivery-area";
import type { DeliveryPin, DeliveryZone, LatLng } from "@/types/delivery";

/**
 * WHERE THE DOOR IS — searched, then pinned on a map.
 *
 * The owner's rule (2026-10-27): the pin decides delivery, never the PIN code.
 * The customer searches their address, the map moves there, and they drag the
 * pin — or tap the map — onto their door. The pin, with the PIN, city and
 * state typed above, is checked by the server the moment it settles, and the
 * answer is said here.
 *
 * Free throughout (owner: "pura map system free wala"): OpenStreetMap tiles
 * through Leaflet, suggestions from OpenStreetMap through the shop's server.
 *
 * What this says is advice. The server checks the same pin again before any
 * order is priced, so nothing done to this component can buy a delivery.
 */

export type PinCheck =
  | { status: "idle" }
  | { status: "checking" }
  | {
      status: "eligible";
      zoneId?: string;
      /** The zone's charge and soonest day, said instead of its name. */
      charge?: number | null;
      minDeliveryDays?: number | null;
      /** The order total past which this delivery is free. */
      freeDeliveryThreshold?: number;
      /** The pin's district and state as the server read them — what the order is priced by. */
      region?: PinRegion | null;
      /** India Post's PIN at the pin, from its nearest post offices — null where none is near. */
      postalCode: string | null;
      /** False when a PIN line runs close by: `otherPincodes` may be the customer's. */
      pincodeSure?: boolean;
      otherPincodes?: string[];
      /** The town and state at the pin, for boxes left empty. */
      city?: string | null;
      state?: string | null;
      formattedAddress: string;
      cityNote?: string;
    }
  | {
      status: "missing" | "invalid" | "outside" | "mismatch" | "unavailable";
      message: string;
      field?: "location" | "pincode" | "state";
      found?: { postalCode: string | null; city: string | null; state: string | null; formattedAddress: string };
      /** Outside: how far the nearest delivery area is, km. */
      kmToArea?: number;
    };

/** What a chosen suggestion said, for filling in boxes the customer left EMPTY. */
export interface PlaceParts {
  postalCode?: string;
  city?: string;
  state?: string;
}

interface DeliveryPinPickerProps {
  pin: DeliveryPin | null;
  onPinChange: (pin: DeliveryPin | null) => void;
  /** The address as typed, which the pin is checked against. */
  pincode: string;
  city: string;
  state: string;
  check: PinCheck;
  onCheck: (check: PinCheck) => void;
  /** The customer chose the map's PIN for the pin. Never done for them. */
  onUsePincode: (pincode: string) => void;
  onPlaceFound: (parts: PlaceParts) => void;
}

/*
  FETCHED WITH THE PAGE, not after it. Waiting for the component to mount
  meant Leaflet's download began only once the whole checkout had hydrated —
  3.7 s to a map on a throttled phone. This module only loads on checkout,
  whose first step is the map, so the map is asked for alongside it.
*/
if (typeof window !== "undefined") void loadLeaflet().catch(() => undefined);

/**
 * Past this, "my current location" is a guess, not a door: a phone's GPS is
 * good to tens of metres, a computer's location comes from its network and
 * can be kilometres out.
 */
const ROUGH_METRES = 150;

/** A search result shown further out than this is a town or wider — never a door. */
const WIDE_PLACE_ZOOM = 15;

/** "800 m", "4 km". */
function formatDistance(metres: number): string {
  return metres < 1000 ? `${Math.round(metres / 50) * 50 || 50} m` : `${Math.round(metres / 1000)} km`;
}

/** The middle of India, for a shop that has drawn no area yet. */
const INDIA: LatLng = { lat: 22.97, lng: 78.65 };

function activeAreas(): DeliveryZone[] {
  return loadDeliveryZones().filter((zone) => zone.isActive && isAreaZone(zone) && hasUsableArea(zone));
}

function areaCenter(zones: DeliveryZone[]): LatLng | null {
  const zone = zones[0];
  if (!zone) return null;
  return shapeMiddle(zoneShapes(zone)[0]);
}

export function DeliveryPinPicker({
  pin,
  onPinChange,
  pincode,
  city,
  state,
  check,
  onCheck,
  onUsePincode,
  onPlaceFound,
}: DeliveryPinPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leaflet = useRef<{
    L: typeof Leaflet;
    map: Leaflet.Map;
    marker: Leaflet.Marker | null;
    areas: Leaflet.LayerGroup;
    /** How sure the device was of "my current location" — drawn until the pin is moved. */
    accuracy: Leaflet.Circle | null;
  } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [locating, setLocating] = useState(false);
  // "Use my current location" from a device that only guessed (a computer, from its network): metres.
  const [roughBy, setRoughBy] = useState<number | null>(null);
  // Where the pin came from — said under the answer, so a point is never mistaken for a checked address.
  const [pinSource, setPinSource] = useState<"device" | "manual" | "search" | null>(null);
  const [deviceMetres, setDeviceMetres] = useState<number | null>(null);
  // The pin "Use my current location" put down, until the customer moves it.
  const locatedAt = useRef("");
  const [retry, setRetry] = useState(0);
  // Whether the key under the map has anything to explain — known once the map is drawn.
  const [hasAreas, setHasAreas] = useState(false);
  // The latest callback, for listeners attached once when the map is built.
  const latest = useRef(onPinChange);
  useEffect(() => {
    latest.current = onPinChange;
  }, [onPinChange]);

  /** Puts the pin on the map, making it the first time. */
  function placeMarker(point: LatLng) {
    const current = leaflet.current;
    if (!current) return;
    if (current.marker) {
      current.marker.setLatLng(point);
      return;
    }
    const marker = current.L.marker(point, { draggable: true, icon: pinIcon(current.L), title: "Your door — drag to move" });
    marker.on("dragend", () => {
      clearAccuracy();
      setPinSource("manual");
      const at = marker.getLatLng();
      latest.current({ lat: at.lat, lng: at.lng });
    });
    marker.addTo(current.map);
    current.marker = marker;
  }

  /* BUILD THE MAP, once, when this step is on screen. */
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
        const zones = activeAreas();
        const start = (pin && isValidLatLng(pin) ? pin : null) ?? areaCenter(zones);
        const map = L.map(mapRef.current, { zoomControl: true }).setView(start ?? INDIA, pin ? 17 : start ? 13 : 5);
        built = map;
        resized = new ResizeObserver(() => map.invalidateSize());
        resized.observe(mapRef.current);

        // The shop's areas, shaded — so a customer can see where it delivers.
        // No names: a zone's name is the owner's own word, not the customer's.
        const areas = L.layerGroup().addTo(map);
        const style = { color: "#15803d", weight: 2, opacity: 0.8, fillOpacity: 0.1, interactive: false };
        for (const zone of zones) {
          drawZoneShapes(L, zone, style, areas);
        }
        addMapControls(L, map, { fitAll: () => boundsOf(L, areas.getLayers()) });
        // No pin yet: every area in view, not a corner of the first one.
        const all = pin ? null : boundsOf(L, areas.getLayers());
        if (all) map.fitBounds(all, { padding: [16, 16], maxZoom: 15, animate: false });

        leaflet.current = { L, map, marker: null, areas, accuracy: null };
        setHasAreas(zones.length > 0);
        if (pin && isValidLatLng(pin)) placeMarker(pin);
        map.on("click", (event: Leaflet.LeafletMouseEvent) => {
          clearAccuracy();
          setPinSource("manual");
          placeMarker(event.latlng);
          latest.current({ lat: event.latlng.lat, lng: event.latlng.lng });
        });
        setMapReady(true);
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
      setMapReady(false);
    };
    // Built once per mount (and on Retry); the pin is synced by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry]);

  /* A pin set from outside (a restored draft, "use my location") moves the marker. */
  useEffect(() => {
    if (!mapReady || !pin || !isValidLatLng(pin)) return;
    placeMarker(pin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin?.lat, pin?.lng, mapReady]);

  /** The device's guess is over once the customer places the pin themselves. */
  function clearAccuracy() {
    const current = leaflet.current;
    current?.accuracy?.remove();
    if (current) current.accuracy = null;
    setRoughBy(null);
  }

  function choose(suggestion: PlaceSuggestion) {
    clearAccuracy();
    const map = leaflet.current?.map;
    const zoom = suggestion.zoom ?? 17;
    map?.setView(suggestion.location, zoom, { animate: false });
    onPlaceFound({ postalCode: suggestion.postalCode, city: suggestion.city, state: suggestion.state });
    // A town, district or state is not a door: the map goes there, and the customer taps theirs.
    if (zoom < WIDE_PLACE_ZOOM) {
      onCheck({ status: "missing", field: "location", message: `Now tap your door on the map — or search your street or area in ${suggestion.label.split(",")[0]}.` });
      return;
    }
    setPinSource("search");
    placeMarker(suggestion.location);
    onPinChange({ ...suggestion.location });
  }

  /* ASK THE SHOP about the pin, a moment after it settles. */
  useEffect(() => {
    if (!pin) {
      onCheck({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      onCheck({ status: "checking" });
      void fetch("/api/checkout/delivery-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: { lat: pin.lat, lng: pin.lng }, pincode, city, state }),
        signal: controller.signal,
      })
        .then(async (res) => {
          const body = (await res.json().catch(() => null)) as { success?: boolean; data?: PinCheck; message?: string } | null;
          if (!res.ok || !body?.success || !body.data) {
            onCheck({
              status: "unavailable",
              message: body?.message ?? "We couldn't check this location right now. Please try again.",
            });
            return;
          }
          onCheck(body.data);
        })
        .catch((error: unknown) => {
          if ((error as { name?: string })?.name === "AbortError") return;
          onCheck({ status: "unavailable", message: "We couldn't reach the shop to check this location. Check your connection." });
        });
    }, 450);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // `onCheck` is the parent's setter; re-asking when it changes identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin?.lat, pin?.lng, pincode, city, state]);

  /*
    OUTSIDE: show the pin AND where the shop delivers, together. Zoomed to the
    pin's street, a customer told "outside" saw roads and nothing else — not
    whether the area was the next street or the next town (owner, 2026-10-28).
  */
  useEffect(() => {
    const current = leaflet.current;
    if (!mapReady || !current || check.status !== "outside" || !pin || !isValidLatLng(pin)) return;
    // "My current location" stays close on the customer: they asked to see where they are. The
    // distance is said under the map, and the "show all" button is one press away.
    if (locatedAt.current === `${pin.lat},${pin.lng}`) return;
    const areas = boundsOf(current.L, current.areas.getLayers());
    if (!areas) return;
    current.map.fitBounds(areas.extend(current.L.latLng(pin.lat, pin.lng)), { padding: [32, 32], maxZoom: 16, animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [check.status, mapReady]);

  function locateMe() {
    setLocating(true);
    void locateDevice()
      .then(({ point, accuracy }) => {
        const current = leaflet.current;
        if (current) {
          current.accuracy?.remove();
          // The circle the device says it is somewhere inside — the honest picture of a guess.
          current.accuracy = accuracy > 0 && Number.isFinite(accuracy)
            ? current.L.circle(point, { radius: accuracy, color: "#2563eb", weight: 1, fillOpacity: 0.08, interactive: false }).addTo(current.map)
            : null;
          if (current.accuracy && accuracy > ROUGH_METRES) {
            current.map.fitBounds(current.accuracy.getBounds(), { padding: [16, 16], maxZoom: 18, animate: false });
          } else {
            current.map.setView(point, 18, { animate: false });
          }
        }
        setRoughBy(accuracy > ROUGH_METRES ? accuracy : null);
        setPinSource("device");
        setDeviceMetres(Number.isFinite(accuracy) ? accuracy : null);
        locatedAt.current = `${point.lat},${point.lng}`;
        placeMarker(point);
        onPinChange(point);
      })
      .catch((error: Error) => onCheck({ status: "missing", field: "location", message: error.message }))
      .finally(() => setLocating(false));
  }

  return (
    <section aria-labelledby="delivery-pin-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="delivery-pin-heading" className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="size-4" aria-hidden /> Delivery location
        </h3>
        <Button type="button" variant="outline" size="sm" onClick={locateMe} disabled={locating || !mapReady}>
          {locating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Crosshair className="size-4" aria-hidden />}
          Use my current location
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Search your area, then drag the pin — or tap the map — onto your door. We deliver to where the pin is.
      </p>

      <PlaceSearch
        onPick={choose}
        near={pin ?? areaCenter(activeAreas())}
        placeholder="Search your building, street or area"
      />

      {/* Leaflet sets z-indexes up to 1000 inside; `isolate` keeps them under the site's header. */}
      <div className="relative isolate overflow-hidden rounded-xl border border-border">
        <div ref={mapRef} className="h-64 w-full bg-muted sm:h-80" aria-label="Map: tap or drag the pin onto your door" />
        {!mapReady && !mapError ? (
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

      {hasAreas ? (
        <p className="-mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block size-3 rounded-sm border-2 border-green-700 bg-green-700/15" aria-hidden />
          Shaded on the map: where we deliver
        </p>
      ) : null}

      {roughBy ? (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          <AlertTriangle className="mt-px size-4 shrink-0" aria-hidden />
          <span>
            This device only knows roughly where you are — within about {formatDistance(roughBy)}. Drag the pin onto
            your door, or search your address.
          </span>
        </p>
      ) : null}

      <PinStatus check={check} pincode={pincode} onUsePincode={onUsePincode} pinNote={pinNoteFor(pin, pinSource, deviceMetres)} />
    </section>
  );
}

/**
 * "Pin 25.14670, 75.84070 · from this device's location (±20 m)" — the point
 * itself and where it came from, kept apart from the map's words for it and
 * from the address the customer typed.
 */
function pinNoteFor(pin: DeliveryPin | null, source: "device" | "manual" | "search" | null, metres: number | null): string {
  if (!pin || !isValidLatLng(pin)) return "";
  const from =
    source === "device"
      ? `from this device's location${metres ? ` (±${formatDistance(metres)})` : ""}`
      : source === "manual"
        ? "placed by you"
        : source === "search"
          ? "from your search — drag it onto your door if it isn't there"
          : "saved earlier";
  return `Pin ${formatLatLng(pin)} · ${from}`;
}

function PinStatus({
  check,
  pincode,
  onUsePincode,
  pinNote,
}: {
  check: PinCheck;
  pincode: string;
  onUsePincode: (pincode: string) => void;
  /** "Pin 25.14670, 75.84070 · from this device's location (±20 m)" — where the point came from. */
  pinNote?: string;
}) {
  if (check.status === "idle") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        No pin yet — search your area or tap the map.
      </p>
    );
  }
  if (check.status === "checking") {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Checking this location…
      </p>
    );
  }
  if (check.status === "eligible") {
    return (
      <div role="status" className="rounded-lg border border-green-600/30 bg-green-50 px-3 py-2 text-sm text-green-900 dark:bg-green-900/20 dark:text-green-200">
        <p className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="size-4" aria-hidden />
          Delivery available
          {/* The charge and the soonest day — not the zone's name, which is the owner's own word. */}
          {typeof check.charge === "number" ? ` · ${check.charge > 0 ? formatCurrency(check.charge) : "Free"}` : ""}
          {/* The order total decides: past the shop's threshold this delivery is free. */}
          {typeof check.charge === "number" && check.charge > 0 && check.freeDeliveryThreshold
            ? ` (free over ${formatCurrency(check.freeDeliveryThreshold)})`
            : ""}
          {/* The zone's days, the shop's lead time and today's cutoff — as the date picker below allows. */}
          {(() => {
            const text = soonestDeliveryText(soonestDeliveryDays(check.minDeliveryDays));
            return text ? ` · ${text}` : "";
          })()}
        </p>
        {/* What the MAP says is at the pin — not the address the customer typed above. */}
        {check.formattedAddress ? (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs">
            <MapPin className="mt-px size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">
              <span className="opacity-80">The map shows here: </span>
              {check.formattedAddress}
            </span>
          </p>
        ) : null}
        <PinAtPin check={check} pincode={pincode} onUsePincode={onUsePincode} />
        {check.cityNote ? <p className="mt-1 text-xs opacity-80">{check.cityNote}</p> : null}
        {pinNote ? <p className="mt-1 text-xs opacity-70">{pinNote}</p> : null}
      </div>
    );
  }
  // A pin still to be placed, or a check that could not be made: amber, not a refusal.
  const soft = check.status === "unavailable" || check.status === "missing";
  const suggested = check.status === "mismatch" && check.field === "pincode" ? check.found?.postalCode : null;
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        soft
          ? "border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"
          : "border-destructive/40 bg-destructive/5 text-destructive",
      )}
    >
      <p className="flex items-start gap-2 font-medium">
        {soft ? <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> : <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}
        {check.message}
      </p>
      {check.found?.formattedAddress ? (
        <p className="mt-1 text-xs opacity-80">
          {check.status === "outside" ? "Pin is near" : "Pin at"}: {check.found.formattedAddress}
        </p>
      ) : null}
      {check.status === "outside" && typeof check.kmToArea === "number" ? (
        <p className="mt-1 text-xs opacity-80">
          About {check.kmToArea < 1 ? "1" : Math.round(check.kmToArea)} km from where we deliver — shaded on the map.
          If this is not where you are, move the pin to your door.
        </p>
      ) : null}
      {pinNote && check.status !== "missing" ? <p className="mt-1 text-xs opacity-70">{pinNote}</p> : null}
      {suggested && suggested !== pincode ? (
        <Button type="button" size="sm" variant="outline" className="mt-2 bg-card" onClick={() => onUsePincode(suggested)}>
          Use PIN {suggested}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The PIN where the pin is, said plainly — and, when it is not the one typed
 * or a PIN line runs close by, one press to use it or a neighbour. Never
 * changed for the customer: the box is theirs.
 */
function PinAtPin({
  check,
  pincode,
  onUsePincode,
}: {
  check: Extract<PinCheck, { status: "eligible" }>;
  pincode: string;
  onUsePincode: (pincode: string) => void;
}) {
  const atPin = check.postalCode;
  if (!atPin) {
    // No post office near enough to say: the customer's PIN stands — but they are asked to check it, never told it is confirmed.
    return (
      <p className="mt-1.5 text-xs">
        We couldn&apos;t find a PIN code for this spot.{" "}
        {pincode ? `Please check that ${pincode} is right for your address.` : "Please type your PIN code above."}
      </p>
    );
  }
  const choices = [atPin, ...(check.pincodeSure ? [] : (check.otherPincodes ?? []))].filter((code) => code !== pincode);
  return (
    <div className="mt-1.5 text-xs">
      <p>
        {/* India Post's PIN for the nearest post office — an estimate, said as one. */}
        PIN code here (nearest post office): <span className="font-semibold tracking-wide">{atPin}</span>
        {pincode && pincode !== atPin ? <span className="opacity-80"> · your address says {pincode}</span> : null}
      </p>
      {choices.length ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="opacity-80">{check.pincodeSure || pincode !== atPin ? "Use" : "Not your PIN? Use"}</span>
          {choices.map((code) => (
            <Button
              key={code}
              type="button"
              size="sm"
              variant="outline"
              className="h-7 bg-card px-2 text-xs"
              onClick={() => onUsePincode(code)}
            >
              {code}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
