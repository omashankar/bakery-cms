import { afterEach, describe, expect, it, vi } from "vitest";

import { answerPinByArea, forgetPincodeAnswers } from "@/components/storefront/pin-area-answer";
import type { DeliveryLookup } from "@/features/commerce/lib/delivery-location";
import { answerPincode } from "@/features/commerce/server/pincode-answer.server";
import type { DeliveryZone } from "@/types/delivery";

/**
 * THE PRODUCT PAGE'S PIN BOX SAYS YES OR NO.
 *
 * The owner (2026-10-27): "customer pin check karega or pehle wala hi msg
 * show hoga yes ya no". For a shop that delivers by map area, the shop's
 * server is asked about the PIN: every one of its post offices (India Post's
 * own locations) is put through the zone rules checkout uses. It used to
 * search the map for the PIN's area by name, and "Borkhera, Kota" found a
 * village of that name in another tehsil (2026-10-28).
 */

const nayapura: DeliveryLookup = {
  served: true,
  needsPin: true,
  areaNames: ["Kota city"],
  zoneName: "",
  minDeliveryDays: null,
  charge: null,
  place: { pincode: "324001", state: "Rajasthan", districts: ["Kota"], areas: ["Kota", "Nayapura"] },
};

function stub(shop: Record<string, unknown> | null) {
  const fetchMock = vi.fn(async () =>
    shop
      ? ({ ok: true, json: async () => ({ success: true, data: shop }) } as unknown as Response)
      : ({ ok: false, json: async () => ({}) } as unknown as Response),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  forgetPincodeAnswers();
});

describe("answerPinByArea — the browser's side", () => {
  it("asks the shop about the PIN itself — no map search by name", async () => {
    const fetchMock = stub({ status: "eligible", charge: 99, minDeliveryDays: 0 });
    await answerPinByArea(nayapura, "324001");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/checkout/delivery-pin");
    expect(JSON.parse(String(init.body))).toEqual({ pincode: "324001" });
  });

  it("is a yes, with the charge and day, when the PIN's offices are delivered", async () => {
    stub({ status: "eligible", charge: 99, minDeliveryDays: 0 });
    expect(await answerPinByArea(nayapura, "324001")).toMatchObject({ served: true, needsPin: false, charge: 99, minDeliveryDays: 0, zoneName: "" });
  });

  it("is a no when none of them is", async () => {
    stub({ status: "outside" });
    expect(await answerPinByArea(nayapura, "324001")).toMatchObject({ served: false, needsPin: false });
  });

  it("says 'parts of this PIN' when some are and some are not — the door decides", async () => {
    stub({ status: "partly" });
    expect(await answerPinByArea(nayapura, "324001")).toMatchObject({ served: true, needsPin: true });
  });

  it("refines a district's answer when a drawn area inside it is cheaper", async () => {
    stub({ status: "eligible", charge: 40, minDeliveryDays: 0, priceMayVary: false });
    const district: DeliveryLookup = { served: true, zoneName: "", minDeliveryDays: 1, charge: 149, priceMayVary: true, place: nayapura.place };
    expect(await answerPinByArea(district, "324001")).toMatchObject({ served: true, charge: 40, minDeliveryDays: 0, priceMayVary: false });
  });

  it("stays 'it depends' when the shop cannot be asked", async () => {
    stub(null);
    expect((await answerPinByArea(nayapura, "324001"))?.needsPin).toBe(true);
  });

  it("leaves an answer the PIN already gave alone, and asks nothing", async () => {
    const fetchMock = stub({ status: "eligible" });
    const yes: DeliveryLookup = { served: true, zoneName: "", minDeliveryDays: 1, charge: 80 };
    expect(await answerPinByArea(yes, "324001")).toBe(yes);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("answerPincode — the server's side, on India Post's real offices", () => {
  const base = { city: "", pincode: "", radiusKm: 0, estimatedDeliveryDays: 1, isActive: true, priority: 50, createdAt: "", updatedAt: "" };
  const kotaCity = { ...base, id: "k", name: "Kota city", coverage: "areas", deliveryCharge: 99, minDeliveryDays: 0, areas: [{ kind: "radius", center: { lat: 25.165795, lng: 75.868835 }, radiusKm: 10 }] } as DeliveryZone;
  const talwandi = {
    ...base, id: "t", name: "Talwandi", coverage: "areas", deliveryCharge: 40, minDeliveryDays: 0,
    areas: [{ kind: "polygon", polygon: [{ lat: 25.152, lng: 75.835 }, { lat: 25.152, lng: 75.852 }, { lat: 25.138, lng: 75.852 }, { lat: 25.138, lng: 75.835 }] }],
  } as DeliveryZone;
  const district = { ...base, id: "d", name: "Kota district", coverage: "cities", cities: ["Kota"], deliveryCharge: 149, minDeliveryDays: 1 } as DeliveryZone;

  it("a Kota city PIN inside the circle is a yes at the circle's charge — one village office 300 m outside does not make it 'partly'", async () => {
    // 324002: seven of its eight offices inside the 10 km circle; Kishan Pura Takiya at 10.3 km.
    expect(await answerPincode("324002", [kotaCity], false)).toMatchObject({ status: "eligible", zone: { id: "k" } });
  });

  it("Sangod's PIN, 55 km out, is a no — the old name search could not be trusted to say so", async () => {
    expect(await answerPincode("325601", [kotaCity], false)).toEqual({ status: "outside" });
  });

  it("…and the shop's fallback where it delivers outside its zones", async () => {
    expect(await answerPincode("325601", [kotaCity], true)).toMatchObject({ status: "eligible", zone: null });
  });

  it("a district zone answers for Sangod; a drawn area inside the district sets the city's charge", async () => {
    expect(await answerPincode("325601", [kotaCity, district], false)).toMatchObject({ status: "eligible", zone: { id: "d" } });
    expect(await answerPincode("324002", [kotaCity, district], false)).toMatchObject({ status: "eligible", zone: { id: "k" } });
  });

  it("says the price may vary where the PIN's offices are charged differently — at the charge most of them get", async () => {
    // A ₹40 circle on Mahaveer Nagar's office: one of 324005's four; the other three pay the ₹99 circle.
    const mahaveer = { ...talwandi, id: "m", areas: [{ kind: "radius", center: { lat: 25.1365, lng: 75.8401 }, radiusKm: 0.5 }] } as DeliveryZone;
    const answer = await answerPincode("324005", [kotaCity, mahaveer], false);
    expect(answer).toMatchObject({ status: "eligible", zone: { id: "k" }, priceMayVary: true });
    // Without the cheaper circle, one charge: nothing to vary.
    expect(await answerPincode("324005", [kotaCity], false)).toMatchObject({ status: "eligible", priceMayVary: false });
  });

  it("is 'partly' where only some of the PIN's offices are inside, and nothing outside is delivered", async () => {
    // A small circle on Mahaveer Nagar's office alone: 324005's other offices fall outside.
    const small = { ...kotaCity, id: "s", areas: [{ kind: "radius", center: { lat: 25.1365, lng: 75.8401 }, radiusKm: 0.5 }] } as DeliveryZone;
    expect(await answerPincode("324005", [small], false)).toEqual({ status: "partly" });
  });

  it("does not know a PIN India Post has never had", async () => {
    expect(await answerPincode("325600", [kotaCity], false)).toEqual({ status: "unknown" });
  });

  it("ignores a switched-off zone", async () => {
    expect(await answerPincode("324002", [{ ...kotaCity, isActive: false }], false)).toEqual({ status: "outside" });
  });
});

describe("the fallback is counted, and the cart can be priced", () => {
  const base = { city: "", pincode: "", radiusKm: 0, estimatedDeliveryDays: 1, isActive: true, priority: 50, createdAt: "", updatedAt: "" };

  it("one office in a cheap circle does not speak for a PIN whose others pay the fallback", async () => {
    // A ₹40 circle on just Mahaveer Nagar's office; 324005's other three are outside every zone.
    const cheap = { ...base, id: "c", name: "Cheap", coverage: "areas", deliveryCharge: 40, minDeliveryDays: 0, areas: [{ kind: "radius", center: { lat: 25.1365, lng: 75.8401 }, radiusKm: 0.5 }] } as DeliveryZone;
    expect(await answerPincode("324005", [cheap], true)).toMatchObject({ status: "eligible", zone: null, priceMayVary: true });
  });

  it("gives a point to price a cart at, inside the zone it answered with", async () => {
    const kotaCity = { ...base, id: "k", name: "Kota city", coverage: "areas", deliveryCharge: 99, minDeliveryDays: 0, areas: [{ kind: "radius", center: { lat: 25.165795, lng: 75.868835 }, radiusKm: 10 }] } as DeliveryZone;
    const answer = await answerPincode("324002", [kotaCity], false);
    expect(answer.status).toBe("eligible");
    if (answer.status !== "eligible" || !answer.at) throw new Error("no point");
    const { zoneContainsPoint } = await import("@/features/commerce/lib/delivery-area");
    expect(zoneContainsPoint(kotaCity, answer.at)).toBe(true);
  });
});
