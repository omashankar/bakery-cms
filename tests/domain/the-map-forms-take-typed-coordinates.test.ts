import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ZoneAreaEditor } from "@/apps/admin/commerce/components/zone-area-editor";
import { DeliveryPinPicker, type PinCheck } from "@/apps/website/checkout/components/delivery-pin-picker";

/**
 * THE MAP FORMS, AS AN OWNER AND A CUSTOMER FIRST SEE THEM.
 *
 * The zone editor must take typed coordinates whatever the map does — an
 * owner can paste them from anywhere — and checkout must offer the search box
 * and say there is no pin yet, rather than a blank where the map will be.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function render(element: ReturnType<typeof createElement>) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(element);
  });
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.unstubAllGlobals();
});

describe("the zone's area editor", () => {
  it("shows a circle's centre and reach in the boxes", async () => {
    const el = await render(
      createElement(ZoneAreaEditor, {
        kind: "radius",
        center: { lat: 24.9227, lng: 76.2869 },
        radiusKm: 5,
        others: [],
        onChange: vi.fn(),
      }),
    );
    expect((el.querySelector("#zone-center-lat") as HTMLInputElement).value).toBe("24.9227");
    expect((el.querySelector("#zone-radius") as HTMLInputElement).value).toBe("5");
  });

  it("shows a boundary's corners one per line, and counts them", async () => {
    const el = await render(
      createElement(ZoneAreaEditor, {
        kind: "polygon",
        radiusKm: 0,
        polygon: [
          { lat: 24.93, lng: 76.27 },
          { lat: 24.94, lng: 76.3 },
          { lat: 24.91, lng: 76.31 },
        ],
        others: [],
        onChange: vi.fn(),
      }),
    );
    expect((el.querySelector("#zone-corners") as HTMLTextAreaElement).value.split("\n")).toEqual([
      "24.930000, 76.270000",
      "24.940000, 76.300000",
      "24.910000, 76.310000",
    ]);
    expect(el.textContent).toContain("3 corners");
  });
});

describe("checkout's delivery location", () => {
  it("offers the search box and says there is no pin yet — and asks the shop nothing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const onCheck = vi.fn();
    const el = await render(
      createElement(DeliveryPinPicker, {
        pin: null,
        onPinChange: vi.fn(),
        pincode: "325601",
        city: "Sangod",
        state: "Rajasthan",
        check: { status: "idle" } as PinCheck,
        onCheck,
        onUsePincode: vi.fn(),
        onPlaceFound: vi.fn(),
      }),
    );
    expect(el.querySelector('input[role="combobox"]')).not.toBeNull();
    expect(el.textContent).toContain("No pin yet");
    expect(onCheck).toHaveBeenCalledWith({ status: "idle" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
