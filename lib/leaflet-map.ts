import type * as Leaflet from "leaflet";

import { isUsableShape, zoneShapes } from "@/features/commerce/lib/delivery-area";
import type { DeliveryZone } from "@/types/delivery";

/**
 * THE MAP IN THE BROWSER — Leaflet over OpenStreetMap, free, with no key.
 *
 * Loaded only where a map is drawn (the checkout's delivery step, a zone's
 * editor): every page of this shop must stay light, so nothing pulls Leaflet
 * in up front.
 *
 * The tiles are OpenStreetMap's own by default, which ask for attribution
 * (shown on the map) and fair use — fine for a shop's checkout, not for heavy
 * traffic. `NEXT_PUBLIC_MAP_TILE_URL` points at another tile server (a hosted
 * one with a free tier, or the shop's own) without touching the code.
 */

export type LeafletModule = typeof Leaflet;

export function tileUrl(): string {
  return process.env.NEXT_PUBLIC_MAP_TILE_URL?.trim() || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
}

export function tileAttribution(): string {
  return (
    process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION?.trim() ||
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
  );
}

/**
 * Photographs of the ground, for an owner drawing round a colony or a
 * customer finding their own roof: Esri's World Imagery, free with its
 * credit shown. `NEXT_PUBLIC_MAP_SATELLITE_URL` swaps it, as above.
 */
export function satelliteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MAP_SATELLITE_URL?.trim() ||
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
  );
}

export function satelliteAttribution(): string {
  return process.env.NEXT_PUBLIC_MAP_SATELLITE_ATTRIBUTION?.trim() || "Imagery &copy; Esri, Maxar, Earthstar Geographics";
}

/** Roads and place names over the photograph — without them a town is a grey smudge. */
const SATELLITE_LABELS = [
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
];

let loading: Promise<LeafletModule> | null = null;

/** Leaflet, once per visit. It touches `window` when imported, so never on the server. */
export function loadLeaflet(): Promise<LeafletModule> {
  if (typeof window === "undefined") return Promise.reject(new Error("The map loads in the browser only"));
  loading ??= import("leaflet")
    .then((module) => ((module as unknown as { default?: LeafletModule }).default ?? module) as LeafletModule)
    .catch((error: unknown) => {
      loading = null;
      throw error instanceof Error ? error : new Error("The map could not load.");
    });
  return loading;
}

/**
 * Every shape of a zone as map layers — one circle, one boundary, or several
 * — added to `target`. One place, so a zone of three mohallas is drawn as
 * three shapes on every map, never as one broken one.
 */
export function drawZoneShapes(
  L: LeafletModule,
  zone: DeliveryZone,
  style: Leaflet.PathOptions,
  target: Leaflet.Map | Leaflet.LayerGroup,
): Leaflet.Path[] {
  return zoneShapes(zone)
    .filter(isUsableShape)
    .map((shape) =>
      (shape.kind === "radius"
        ? L.circle(shape.center, { ...style, radius: shape.radiusKm * 1000 })
        : L.polygon(shape.polygon, style)
      ).addTo(target),
    );
}

/** A pin drawn in SVG — Leaflet's default marker is an image bundlers lose. */
export function pinIcon(L: LeafletModule, color = "#b91c1c"): Leaflet.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    html: `<svg width="30" height="40" viewBox="0 0 30 40" aria-hidden="true"><path d="M15 0C6.7 0 0 6.6 0 14.8 0 25.9 15 40 15 40s15-14.1 15-25.2C30 6.6 23.3 0 15 0z" fill="${color}"/><circle cx="15" cy="15" r="5.5" fill="#fff"/></svg>`,
  });
}

/** A small round handle, for dragging a circle's edge or a boundary's corner. */
export function handleIcon(L: LeafletModule, color = "#15803d"): Leaflet.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:#fff;border:3px solid ${color};box-shadow:0 1px 3px rgb(0 0 0 / .35)"></span>`,
  });
}

const ICONS = {
  expand:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',
  shrink:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>',
  all:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V3h4M17 3h4v4M21 17v4h-4M7 21H3v-4"/><circle cx="12" cy="12" r="3.5"/></svg>',
};

/** A small bar of buttons in Leaflet's own style, whose clicks never reach the map beneath. */
function buttonBar(L: LeafletModule, position: Leaflet.ControlPosition, build: (bar: HTMLElement) => void): Leaflet.Control {
  const Bar = L.Control.extend({
    onAdd() {
      const bar = L.DomUtil.create("div", "leaflet-bar");
      L.DomEvent.disableClickPropagation(bar);
      L.DomEvent.disableScrollPropagation(bar);
      build(bar);
      return bar;
    },
  });
  return new Bar({ position });
}

function barButton(bar: HTMLElement, html: string, label: string, onClick: () => void): HTMLAnchorElement {
  const button = document.createElement("a");
  button.href = "#";
  button.role = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.innerHTML = html;
  button.style.display = "flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    onClick();
  });
  bar.append(button);
  return button;
}

/**
 * WHAT EVERY MAP IN THE SHOP OFFERS — the owner asked (2026-10-28) for "real
 * map … propar facility": the street map, or a photograph of the ground with
 * the roads and names over it; a km scale, so "10 km" can be seen; full
 * screen, for drawing round a colony on a phone; and a button back to every
 * delivery area after wandering off. Adds the base map itself, so a map built
 * with this has no tileLayer of its own.
 *
 * The mouse wheel zooms only once the map has been clicked into: a map that
 * caught the wheel stopped the page scrolling under it.
 */
export function addMapControls(
  L: LeafletModule,
  map: Leaflet.Map,
  { fitAll, fitLabel = "Show all delivery areas" }: { fitAll?: () => Leaflet.LatLngBounds | null; fitLabel?: string } = {},
): void {
  const street = L.tileLayer(tileUrl(), { attribution: tileAttribution(), maxZoom: 19 });
  const satellite = L.layerGroup([
    L.tileLayer(satelliteUrl(), { attribution: satelliteAttribution(), maxZoom: 19, maxNativeZoom: 18 }),
    ...SATELLITE_LABELS.map((url) => L.tileLayer(url, { maxZoom: 19, maxNativeZoom: 18 })),
  ]);
  street.addTo(map);

  // Map | Satellite, as two words rather than Leaflet's stacked-squares icon nobody reads.
  buttonBar(L, "topright", (bar) => {
    bar.style.display = "flex";
    bar.style.overflow = "hidden";
    const choices: [string, Leaflet.Layer][] = [
      ["Map", street],
      ["Satellite", satellite],
    ];
    const buttons = choices.map(([name, layer]) => {
      const button = barButton(bar, name, `Show the ${name.toLowerCase()} view`, () => {
        for (const [, other] of choices) if (other !== layer) map.removeLayer(other);
        if (!map.hasLayer(layer)) layer.addTo(map);
        paint();
      });
      Object.assign(button.style, { width: "auto", padding: "0 10px", font: "600 12px/30px system-ui, sans-serif", borderBottom: "none" });
      return button;
    });
    function paint() {
      buttons.forEach((button, i) => {
        const on = map.hasLayer(choices[i][1]);
        button.style.background = on ? "#1f2937" : "#fff";
        button.style.color = on ? "#fff" : "#1f2937";
        button.setAttribute("aria-pressed", String(on));
      });
    }
    paint();
  }).addTo(map);

  const scale = L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
  // On a phone-wide map the credit line runs the full width and hid the scale: lift it above.
  const lift = () => {
    const container = scale.getContainer();
    if (container) container.style.marginBottom = map.getSize().x < 520 ? "24px" : "";
  };
  lift();
  map.on("resize", lift);

  const box = map.getContainer();
  const frame = box.parentElement ?? box;
  // Not on an iPhone, which lets only a video go full screen: no button beats one that does nothing.
  const canFill = typeof document !== "undefined" && document.fullscreenEnabled && typeof frame.requestFullscreen === "function";
  if (fitAll || canFill) {
    buttonBar(L, "topleft", (bar) => {
      if (fitAll) {
        barButton(bar, ICONS.all, fitLabel, () => {
          const bounds = fitAll();
          if (bounds?.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15, animate: false });
        });
      }
      if (canFill) {
        const height = box.style.height;
        const button = barButton(bar, ICONS.expand, "Full screen", () => {
          if (document.fullscreenElement === frame) void document.exitFullscreen();
          else void frame.requestFullscreen().catch(() => undefined);
        });
        const sync = () => {
          const full = document.fullscreenElement === frame;
          // The map's own box has a fixed height; full screen, it takes the screen.
          box.style.height = full ? "100%" : height;
          button.innerHTML = full ? ICONS.shrink : ICONS.expand;
          button.title = full ? "Exit full screen" : "Full screen";
          button.setAttribute("aria-label", button.title);
          map.invalidateSize();
        };
        document.addEventListener("fullscreenchange", sync);
        map.on("unload", () => document.removeEventListener("fullscreenchange", sync));
      }
    }).addTo(map);
  }

  map.scrollWheelZoom.disable();
  map.on("focus", () => map.scrollWheelZoom.enable());
  map.on("blur", () => map.scrollWheelZoom.disable());
}

/** Everything in `layers`, as one box — null when there is nothing to frame. */
export function boundsOf(L: LeafletModule, layers: Leaflet.Layer[]): Leaflet.LatLngBounds | null {
  const drawn = layers.filter((layer): layer is Leaflet.Path | Leaflet.Marker => "getBounds" in layer || "getLatLng" in layer);
  if (!drawn.length) return null;
  const bounds = L.featureGroup(drawn).getBounds();
  return bounds.isValid() ? bounds : null;
}
