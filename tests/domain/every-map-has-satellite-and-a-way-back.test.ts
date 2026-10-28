import { afterEach, describe, expect, it } from "vitest";
import * as Leaflet from "leaflet";

import { addMapControls, boundsOf, satelliteUrl, tileUrl } from "@/lib/leaflet-map";

/**
 * EVERY MAP HAS A SATELLITE VIEW AND A WAY BACK.
 *
 * The owner asked (2026-10-28) for "real map … sab area ache se dikhane …
 * propar facility". Each of the shop's maps — the delivery map, a zone's
 * editor, checkout — is built through `addMapControls`: the street map or a
 * photograph of the ground, a km scale, and a button back to every delivery
 * area. Driven through real Leaflet here, not read as text.
 */

const L = ((Leaflet as unknown as { default?: typeof Leaflet }).default ?? Leaflet) as typeof Leaflet;

let maps: Leaflet.Map[] = [];
afterEach(() => {
  maps.forEach((map) => map.remove());
  maps = [];
  document.body.innerHTML = "";
});

function build() {
  const frame = document.createElement("div");
  const box = document.createElement("div");
  frame.append(box);
  document.body.append(frame);
  const map = L.map(box).setView({ lat: 25.16, lng: 75.86 }, 12);
  maps.push(map);
  return map;
}

const tileUrls = (map: Leaflet.Map) => {
  const urls: string[] = [];
  map.eachLayer((layer) => {
    if (layer instanceof L.TileLayer) urls.push((layer as unknown as { _url: string })._url);
  });
  return urls;
};

const button = (map: Leaflet.Map, name: string) =>
  map.getContainer().querySelector<HTMLAnchorElement>(`a[aria-label="${name}"]`);

describe("addMapControls", () => {
  it("starts on the street map and switches to the photograph, with roads and names over it", () => {
    const map = build();
    addMapControls(L, map);
    expect(tileUrls(map)).toEqual([tileUrl()]);
    expect(button(map, "Show the map view")?.getAttribute("aria-pressed")).toBe("true");

    button(map, "Show the satellite view")!.click();
    const now = tileUrls(map);
    expect(now).toContain(satelliteUrl());
    expect(now).not.toContain(tileUrl());
    // The photograph alone is a grey smudge: roads and place names ride on it.
    expect(now.length).toBeGreaterThan(1);
    expect(button(map, "Show the satellite view")?.getAttribute("aria-pressed")).toBe("true");

    button(map, "Show the map view")!.click();
    expect(tileUrls(map)).toEqual([tileUrl()]);
  });

  it("draws a km scale", () => {
    const map = build();
    addMapControls(L, map);
    expect(map.getContainer().querySelector(".leaflet-control-scale")).not.toBeNull();
  });

  it("brings every area back into view, and offers no such button with nothing to frame", () => {
    const map = build();
    const areas = L.layerGroup().addTo(map);
    L.polygon([
      [25.3, 75.7],
      [25.3, 76.0],
      [25.0, 76.0],
    ]).addTo(areas);
    let asked = 0;
    addMapControls(L, map, {
      fitAll: () => {
        asked += 1;
        return boundsOf(L, areas.getLayers());
      },
    });
    button(map, "Show all delivery areas")!.click();
    expect(asked).toBe(1);

    const bare = build();
    addMapControls(L, bare);
    expect(button(bare, "Show all delivery areas")).toBeNull();
  });

  it("leaves the mouse wheel to the page until the map is clicked into", () => {
    const map = build();
    addMapControls(L, map);
    expect(map.scrollWheelZoom.enabled()).toBe(false);
    map.fire("focus");
    expect(map.scrollWheelZoom.enabled()).toBe(true);
    map.fire("blur");
    expect(map.scrollWheelZoom.enabled()).toBe(false);
  });

  it("a press on a map button never reaches the map, where it would drop a pin", () => {
    const map = build();
    addMapControls(L, map);
    let clicks = 0;
    map.on("click", () => (clicks += 1));
    button(map, "Show the satellite view")!.click();
    expect(clicks).toBe(0);
  });
});

describe("boundsOf", () => {
  it("is null for nothing, so a shop with no areas does not fly to the ocean", () => {
    expect(boundsOf(L, [])).toBeNull();
  });
});

describe("the street map names the colonies", () => {
  it("is Esri's World Street Map by default — OpenStreetMap's own tiles name no colony in Kota", async () => {
    const { tileMaxNativeZoom } = await import("@/lib/leaflet-map");
    expect(tileUrl()).toContain("World_Street_Map");
    // Esri draws Indian towns to 17; beyond, the 17 tiles are enlarged, never a "no data" tile.
    expect(tileMaxNativeZoom()).toBe(17);
  });

  it("asks the street server for nothing past its own zoom", () => {
    const map = build();
    addMapControls(L, map);
    const street = (() => {
      let found: Leaflet.TileLayer | null = null;
      map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer && (layer as unknown as { _url: string })._url === tileUrl()) found = layer;
      });
      return found as Leaflet.TileLayer | null;
    })();
    expect(street?.options.maxNativeZoom).toBe(17);
    expect(street?.options.maxZoom).toBe(19);
  });
});
