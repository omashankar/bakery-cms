"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { CheckCircle2, ExternalLink, Loader2, MapPinned, RotateCw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PlaceSearch } from "@/components/shared/place-search";
import { addMapControls, boundsOf, drawZoneShapes, loadLeaflet, pinIcon } from "@/lib/leaflet-map";
import { formatLatLng, hasUsableArea, isAreaZone, isRegionZone, mapsLinkFor } from "@/features/commerce/lib/delivery-area";
import { formatZoneDeliveryTime } from "@/features/commerce/lib/delivery-zone-utils";
import type { DeliveryZone, LatLng } from "@/types/delivery";
import type { CommerceSettings } from "@/types/settings";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";
import { noteAuthStatus } from "@/features/auth/lib/session-expiry";

/**
 * THE WHOLE DELIVERY MAP, ON ONE SCREEN.
 *
 * Every live zone drawn in its own colour, so an owner who prices area by
 * area — Talwandi ₹40, Borkheda ₹60, the rest of Kota ₹80 — sees the town as
 * customers will meet it, gaps and overlaps included. Tap anywhere and the
 * answer is the one checkout gives a customer pinned there: asked of the same
 * server check, so district and state zones answer too. Tap a zone to edit it.
 */

const COLOURS = ["#15803d", "#2563eb", "#b45309", "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#dc2626"];

type Answer =
  | { status: "checking" }
  | { status: "eligible"; zoneId: string; formattedAddress: string }
  | { status: "refused"; message: string };

export function ZoneCoverageMap({
  zones,
  commerce,
  onEdit,
  className,
}: {
  zones: DeliveryZone[];
  commerce: Pick<CommerceSettings, "useZoneBasedDelivery" | "deliverOutsideZones" | "zoneFallbackDeliveryFee" | "deliveryFee">;
  onEdit: (zone: DeliveryZone) => void;
  className?: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leaflet = useRef<{ L: typeof Leaflet; map: Leaflet.Map; shapes: Leaflet.LayerGroup; probe: Leaflet.Marker | null } | null>(null);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [point, setPoint] = useState<LatLng | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const latestEdit = useRef(onEdit);
  useEffect(() => {
    latestEdit.current = onEdit;
  }, [onEdit]);
  // For the map's own listeners, attached once: the check as of the last render.
  const latestCheck = useRef<(at: LatLng) => void>(() => undefined);
  useEffect(() => {
    latestCheck.current = checkSpot;
  });

  const drawn = zones.filter((zone) => zone.isActive && isAreaZone(zone) && hasUsableArea(zone));
  const regions = zones.filter((zone) => zone.isActive && isRegionZone(zone));
  const colourOf = (zone: DeliveryZone) => COLOURS[Math.max(0, zones.indexOf(zone)) % COLOURS.length];

  /* The map, once. */
  useEffect(() => {
    if (!mapRef.current) return;
    let alive = true;
    let built: Leaflet.Map | null = null;
    let resized: ResizeObserver | null = null;
    void loadLeaflet()
      .then((L) => {
        if (!alive || !mapRef.current) return;
        const map = L.map(mapRef.current, { doubleClickZoom: false }).setView({ lat: 22.97, lng: 78.65 }, 5);
        built = map;
        resized = new ResizeObserver(() => map.invalidateSize());
        resized.observe(mapRef.current);
        const shapes = L.layerGroup().addTo(map);
        addMapControls(L, map, { fitAll: () => boundsOf(L, shapes.getLayers()) });
        leaflet.current = { L, map, shapes, probe: null };
        map.on("click", (event: Leaflet.LeafletMouseEvent) => latestCheck.current({ lat: event.latlng.lat, lng: event.latlng.lng }));
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
  }, [retry]);

  /* The zones, redrawn when they change — and the map fitted to them the first time. */
  const fitted = useRef(false);
  useEffect(() => {
    const current = leaflet.current;
    if (!ready || !current) return;
    const { L, map, shapes } = current;
    shapes.clearLayers();
    for (const zone of drawn) {
      const colour = colourOf(zone);
      const style = { color: colour, weight: 2.5, fillColor: colour, fillOpacity: 0.15 };
      for (const shape of drawZoneShapes(L, zone, style, shapes)) {
        shape
        // Named ON the map, not only on hover: a phone has no hover, and the
        // owner reads the town by its prices at a glance.
        .bindTooltip(`${zone.name} · ${formatCurrency(zone.deliveryCharge)}`, {
          permanent: true,
          direction: "center",
          className: "zone-label",
          opacity: 0.92,
        })
        .on("click", (event: Leaflet.LeafletMouseEvent) => {
          // A tap on a zone checks the spot too, like a tap anywhere else.
          latestCheck.current({ lat: event.latlng.lat, lng: event.latlng.lng });
        })
        .on("dblclick", () => latestEdit.current(zone));
      }
    }
    const bounds = boundsOf(L, shapes.getLayers());
    if (!fitted.current && bounds) {
      fitted.current = true;
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14, animate: false });
    }
    // `drawn` is derived from `zones`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, zones]);

  /* What checkout would say for a spot — asked of the server's own check. */
  const asking = useRef<AbortController | null>(null);
  function checkSpot(at: LatLng) {
    const current = leaflet.current;
    if (!current) return;
    setPoint(at);
    if (current.probe) current.probe.setLatLng(at);
    else current.probe = current.L.marker(at, { icon: pinIcon(current.L) }).addTo(current.map);
    setAnswer({ status: "checking" });
    asking.current?.abort();
    const controller = new AbortController();
    asking.current = controller;
    void fetch("/api/checkout/delivery-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: at }),
      signal: controller.signal,
    })
      .then(async (res) => {
        // An admin screen: a session that ended is said, like every other request here.
        noteAuthStatus(res.status);
        const body = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: { status: string; zoneId?: string; formattedAddress?: string; message?: string; required?: boolean };
        } | null;
        const data = body?.data;
        if (!res.ok || !data) return setAnswer({ status: "refused", message: "Could not check this spot. Try again." });
        if (data.status === "eligible") {
          return setAnswer({ status: "eligible", zoneId: data.zoneId ?? "", formattedAddress: data.formattedAddress ?? "" });
        }
        setAnswer({ status: "refused", message: data.message ?? "Not delivered here." });
      })
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name !== "AbortError") setAnswer({ status: "refused", message: "Could not check this spot." });
      });
  }

  const matched = answer?.status === "eligible" ? zones.find((zone) => zone.id === answer.zoneId) : undefined;

  return (
    <section className={cn("space-y-3 rounded-xl border border-border bg-card p-3 sm:p-4", className)} aria-labelledby="zone-map-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="zone-map-title" className="flex items-center gap-2 text-sm font-semibold">
          <MapPinned className="size-4" aria-hidden /> Delivery map
        </h2>
        <p className="text-xs text-muted-foreground">Tap anywhere to see what a customer there is told. Double-tap a zone to edit it.</p>
      </div>

      <PlaceSearch
        onPick={(place) => {
          const zoom = place.zoom ?? 15;
          leaflet.current?.map.setView(place.location, Math.min(zoom, 15), { animate: false });
          // A town or wider is many answers: the owner taps the spot to check.
          if (zoom >= 15) checkSpot(place.location);
        }}
        placeholder="Find an area or address to check"
      />

      {/* Leaflet sets z-indexes up to 1000 inside; `isolate` keeps them under the admin's own layers. */}
      <div className="relative isolate overflow-hidden rounded-lg border border-border">
        <div ref={mapRef} className="h-80 w-full bg-muted lg:h-96" aria-label="Map of every delivery zone" />
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

      {/* The key: every live zone, drawn or by name, in its colour. */}
      {drawn.length || regions.length ? (
        <ul className="flex flex-wrap gap-2 text-xs" aria-label="Live zones">
          {[...drawn, ...regions].map((zone) => (
            <li key={zone.id}>
              <button
                type="button"
                onClick={() => onEdit(zone)}
                className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 hover:bg-muted"
              >
                <span className="size-2.5 rounded-full" style={{ background: isAreaZone(zone) ? colourOf(zone) : "transparent", border: `2px solid ${colourOf(zone)}` }} />
                <span className="font-medium">{zone.name}</span>
                <span className="text-muted-foreground">
                  {formatCurrency(zone.deliveryCharge)}
                  {isRegionZone(zone) ? ` · ${(zone.coverage === "cities" ? zone.cities : zone.states)?.join(", ")}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-amber-700 dark:text-amber-300">No live zone has an area yet, so no address can be delivered. Add a zone or edit one.</p>
      )}

      {point && answer ? (
        <div className="flex items-start gap-2 text-sm" aria-live="polite">
          {answer.status === "checking" ? (
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
          ) : answer.status === "eligible" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-700" aria-hidden />
          ) : (
            <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          )}
          <div className="min-w-0 space-y-0.5">
            <p className="font-medium text-foreground">
              {answer.status === "checking"
                ? "Checking…"
                : answer.status === "eligible"
                  ? !commerce.useZoneBasedDelivery
                    ? `Zone pricing is off, so every order pays the flat fee of ${formatCurrency(commerce.deliveryFee)}.`
                    : matched
                      ? `Delivered by "${matched.name}" for ${formatCurrency(matched.deliveryCharge)} · ${formatZoneDeliveryTime(matched)}.`
                      : `Outside every zone — charged the fallback fee of ${formatCurrency(commerce.zoneFallbackDeliveryFee ?? commerce.deliveryFee)}.`
                  : answer.message}
            </p>
            {answer.status === "eligible" && answer.formattedAddress ? <p className="text-xs text-muted-foreground">{answer.formattedAddress}</p> : null}
            <p className="text-xs text-muted-foreground">
              {formatLatLng(point)} ·{" "}
              <a href={mapsLinkFor(point)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                Open in Google Maps <ExternalLink className="size-3" aria-hidden />
              </a>
              {matched ? (
                <>
                  {" · "}
                  <button type="button" className="underline underline-offset-2" onClick={() => onEdit(matched)}>
                    Edit this zone
                  </button>
                </>
              ) : null}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
