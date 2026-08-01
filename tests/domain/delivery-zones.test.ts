import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { findDeliveryZone, matchesZonePincode } from "@/features/commerce/lib/delivery-zone-utils";
import {
  createDeliveryZone,
  deleteDeliveryZones,
  loadDeliveryZones,
  persistServerZones,
} from "@/features/commerce/lib/delivery-zones-repository";
import { couponsHydration, zonesHydration } from "@/features/commerce/lib/commerce-api";
import { calculateDeliveryQuote } from "@/features/orders/lib/delivery-pricing";
import { calculateCartTotals } from "@/features/orders/lib/cart-totals";
import {
  earliestDeliveryDateString,
  isBeforeLeadTime,
} from "@/features/orders/lib/delivery-date";
import type { DeliveryZone } from "@/types/delivery";
import type { CommerceSettings } from "@/types/settings";

/**
 * Delivery zones decide the delivery charge, so a wrong zone is a wrong price.
 *
 * There was no coverage at all: every existing test that touched delivery pinned
 * the flat-fee branch, and the server pricing test stubbed the zone list empty —
 * which is exactly why the server could price live checkouts from the demo seed
 * zones for as long as it did without a single test noticing.
 */

function zone(over: Partial<DeliveryZone> = {}): DeliveryZone {
  return {
    id: "z1",
    name: "Zone",
    city: "Bengaluru",
    pincode: "560001",
    radiusKm: 10,
    deliveryCharge: 50,
    minDeliveryDays: 1,
    estimatedDeliveryDays: 2,
    isActive: true,
    priority: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function commerce(over: Partial<CommerceSettings> = {}): CommerceSettings {
  return {
    useZoneBasedDelivery: true,
    deliveryFee: 99,
    zoneFallbackDeliveryFee: 149,
    freeDeliveryThreshold: 999,
    ...over,
  } as CommerceSettings;
}

describe("pincode matching", () => {
  it("matches a full 6-digit zone exactly", () => {
    expect(matchesZonePincode("560001", "560001")).toBe(true);
    expect(matchesZonePincode("560001", "560002")).toBe(false);
  });

  it("treats a shorter zone pincode as a prefix", () => {
    expect(matchesZonePincode("5600", "560034")).toBe(true);
    expect(matchesZonePincode("5600", "411001")).toBe(false);
  });

  it("ignores punctuation and spacing on both sides", () => {
    expect(matchesZonePincode(" 560-001 ", "560 001")).toBe(true);
  });

  it("never matches on an empty pincode", () => {
    // Otherwise a zone with a blank pincode would silently catch every address.
    expect(matchesZonePincode("", "560001")).toBe(false);
    expect(matchesZonePincode("560001", "")).toBe(false);
  });
});

describe("which zone wins", () => {
  it("prefers the MORE SPECIFIC pincode rule over a cheaper broad one", () => {
    // The form creates every zone at the same default priority, so two zones
    // used to be separated only by price — and a broad prefix at a lower charge
    // outbid the exact-pincode zone the admin had just built for that address.
    const broad = zone({ id: "broad", pincode: "56", deliveryCharge: 40, priority: 1 });
    const exact = zone({ id: "exact", pincode: "560034", deliveryCharge: 60, priority: 1 });

    const match = findDeliveryZone([broad, exact], { city: "Bengaluru", pincode: "560034" });
    expect(match?.zone.id).toBe("exact");
  });

  it("lets an explicit priority beat specificity's tie", () => {
    const a = zone({ id: "a", pincode: "560034", deliveryCharge: 60, priority: 1 });
    const b = zone({ id: "b", pincode: "560034", deliveryCharge: 80, priority: 9 });

    expect(findDeliveryZone([a, b], { pincode: "560034" })?.zone.id).toBe("b");
  });

  it("breaks a complete tie in the CUSTOMER's favour", () => {
    // Ids chosen so ALPHABETICAL order opposes price: the last-resort id key
    // would pick "a-dear", so only the price key can produce "z-cheap". The first
    // version used "dear"/"cheap" and passed with the price key deleted.
    const dear = zone({ id: "a-dear", pincode: "560034", deliveryCharge: 90, priority: 1 });
    const cheap = zone({ id: "z-cheap", pincode: "560034", deliveryCharge: 30, priority: 1 });

    expect(findDeliveryZone([dear, cheap], { pincode: "560034" })?.zone.id).toBe("z-cheap");
  });

  it("prefers a zone whose city also agrees, among rules of EQUAL precision", () => {
    // Equal pincode length on purpose. The earlier version of this test pitted a
    // 1-digit prefix against a 3-digit one, so it passed on specificity alone and
    // said nothing about the city key it claimed to cover — it passed with that
    // key deleted.
    const wrongCity = zone({ id: "wrong", city: "Mumbai", pincode: "411", deliveryCharge: 30 });
    const rightCity = zone({ id: "right", city: "Pune", pincode: "411", deliveryCharge: 70 });

    const match = findDeliveryZone([wrongCity, rightCity], { city: "Pune", pincode: "411001" });
    expect(match?.zone.id).toBe("right");
  });

  it("does NOT let the customer's typed city beat a more precise pincode rule", () => {
    // The city is free text the shopper fills in. Ranking it above specificity
    // let them choose their own zone: type the cheap zone's city and a one-digit
    // prefix outranked the exact six-digit rule built for that address.
    const cheapBroad = zone({ id: "broad", city: "Mumbai", pincode: "4", deliveryCharge: 30 });
    const exact = zone({ id: "exact", city: "Pune", pincode: "411001", deliveryCharge: 90 });

    const match = findDeliveryZone([cheapBroad, exact], { city: "Mumbai", pincode: "411001" });
    expect(match?.zone.id).toBe("exact");
  });

  it("still uses a multi-city prefix when nothing better matches", () => {
    const loose = zone({ id: "loose", city: "Mumbai", pincode: "4", deliveryCharge: 30 });
    expect(findDeliveryZone([loose], { city: "Nashik", pincode: "422001" })?.zone.id).toBe("loose");
  });

  it("ignores inactive zones entirely", () => {
    const off = zone({ id: "off", pincode: "560034", isActive: false });
    expect(findDeliveryZone([off], { pincode: "560034" })).toBeNull();
  });

  it("falls back to a city match when no pincode rule matches", () => {
    const byCity = zone({ id: "city", city: "Bengaluru", pincode: "999999" });
    const match = findDeliveryZone([byCity], { city: "bengaluru ", pincode: "560034" });
    expect(match?.matchType).toBe("city");
  });
});

describe("the zones reach the total the server actually charges", () => {
  // THE bug, pinned at the layer it lived in.
  //
  // `calculateDeliveryQuote` always honoured the zones it was handed; the defect
  // was one layer up, where `calculateCartTotals` declared `zonesOverride` and
  // never forwarded it. Testing the quote function alone passes either way —
  // which is why this has to go through the totals helper, the way the server
  // pricing path does.
  const zones = [zone({ id: "blr", city: "Bengaluru", pincode: "5600", deliveryCharge: 49 })];
  const items = [{ productSlug: "cake", name: "Cake", price: 500, quantity: 1 }];

  it("forwards zonesOverride from cart totals to the zone lookup", () => {
    const totals = calculateCartTotals({
      items: items as never,
      deliveryAddress: { city: "Bengaluru", pincode: "560034" },
      commerceOverride: commerce(),
      zonesOverride: zones,
    });

    expect(totals.delivery).toBe(49);
    expect(totals.deliveryZoneName).toBe("Zone");
  });

  it("does not silently fall back to the flat or fallback fee when zones are given", () => {
    const totals = calculateCartTotals({
      items: items as never,
      deliveryAddress: { city: "Bengaluru", pincode: "560034" },
      commerceOverride: commerce(),
      zonesOverride: zones,
    });

    // 149 = the fallback the server produced for every address once the zones
    // were dropped and nothing matched the demo rows.
    expect(totals.delivery).not.toBe(149);
    expect(totals.delivery).not.toBe(99);
  });
});

describe("the delivery-date floor", () => {
  // The client built a LOCAL midnight and read it back through toISOString()
  // (UTC), so in any positive offset — IST, this shop's whole market — the
  // picker's minimum was a day earlier than the day computed, and the server
  // guard rejected exactly that date. AFTER the card was captured.
  // Built from LOCAL components, not an instant string. `new Date("...+05:30")`
  // is a moment, and which calendar day it falls on depends on the reader's
  // timezone — so the first version of these assertions passed in IST and failed
  // in UTC. The helper works in the local calendar by design (it is the
  // CUSTOMER's calendar that a delivery date belongs to), so the fixture has to
  // be local too.
  const AUG_1 = new Date(2026, 7, 1, 13, 0, 0);

  it("is the same calendar day the server will accept", () => {
    const floor = earliestDeliveryDateString(2, AUG_1);
    expect(floor).toBe("2026-08-03");
    expect(isBeforeLeadTime(floor, 2, AUG_1)).toBe(false);
  });

  it("does not drift with the clock inside a day", () => {
    // 00:30 IST is 19:00Z the previous day — the window where a UTC read flips.
    const lateNight = new Date(2026, 7, 1, 0, 30, 0);
    expect(earliestDeliveryDateString(2, lateNight)).toBe("2026-08-03");
  });

  it("still refuses a date that is genuinely too soon", () => {
    expect(isBeforeLeadTime("2026-08-01", 5, AUG_1)).toBe(true);
  });

  it("allows a day of slack, because refusing happens after payment", () => {
    // The customer's calendar and the server's can differ by a day. A refusal
    // here strands a captured payment, so the guard is deliberately lenient by
    // one day — which still cannot buy same-day on a five-day zone.
    expect(isBeforeLeadTime("2026-08-02", 2, AUG_1)).toBe(false);
    expect(isBeforeLeadTime("2026-08-01", 2, AUG_1)).toBe(true);
  });

  it("does nothing when the zone has no lead time", () => {
    expect(isBeforeLeadTime("2026-08-01", 0, AUG_1)).toBe(false);
  });
});

describe("a save the server refuses", () => {
  beforeEach(() => {
    localStorage.clear();
    couponsHydration.markSettled();
  zonesHydration.markSettled();
  });
  afterEach(() => vi.unstubAllGlobals());

  function stubServer(ok: boolean) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok,
        status: ok ? 200 : 422,
        json: () => Promise.resolve({ success: ok, data: null }),
      } as unknown as Response),
    );
  }

  it("does not leave the rejected value in the local cache", async () => {
    // The local write used to stand whatever the server said — and because every
    // save sends the WHOLE list, one rejected row made every LATER save fail
    // too. A single decimal in a days field permanently bricked zone editing in
    // that browser, with no message and no way out but clearing site data.
    persistServerZones([zone({ id: "kept", name: "Kept" })]);

    stubServer(false);
    const result = await createDeliveryZone({
      name: "Rejected",
      city: "Pune",
      pincode: "411001",
      radiusKm: 1,
      deliveryCharge: 10,
      minDeliveryDays: 1,
      estimatedDeliveryDays: 2,
      isActive: true,
      priority: 1,
    } as never);

    expect(result.persisted).toBe(false);

    const after = loadDeliveryZones();
    expect(after.map((z) => z.id)).toEqual(["kept"]);
  });

  it("keeps an accepted value", async () => {
    persistServerZones([zone({ id: "kept" })]);
    stubServer(true);

    const result = await createDeliveryZone({
      name: "Accepted",
      city: "Pune",
      pincode: "411001",
      radiusKm: 1,
      deliveryCharge: 10,
      minDeliveryDays: 1,
      estimatedDeliveryDays: 2,
      isActive: true,
      priority: 1,
    } as never);

    expect(result.persisted).toBe(true);
    expect(loadDeliveryZones()).toHaveLength(2);
  });

  it("tells the server which zones it knew about, so a stale tab cannot delete newer ones", async () => {
    persistServerZones([zone({ id: "a" }), zone({ id: "b" })]);

    let sent: unknown = null;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        sent = JSON.parse(String(init.body));
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: null }),
        } as unknown as Response);
      }),
    );

    await deleteDeliveryZones(["b"]);

    // Without knownIds a replace-all asserts "these are ALL the zones", so a
    // zone another device created since this tab loaded would be deleted too.
    expect(sent).toMatchObject({ knownIds: ["a", "b"] });
    expect((sent as { zones: DeliveryZone[] }).zones.map((z) => z.id)).toEqual(["a"]);
  });
});

describe("what the customer is charged", () => {
  const zones = [zone({ id: "blr", city: "Bengaluru", pincode: "5600", deliveryCharge: 49 })];

  it("charges the matched zone's fee", () => {
    const quote = calculateDeliveryQuote(
      { subtotal: 500, city: "Bengaluru", pincode: "560034" },
      commerce(),
      zones,
    );
    expect(quote.delivery).toBe(49);
    expect(quote.zoneName).toBe("Zone");
  });

  it("uses the shop's OWN zones, not a seed, when they are passed in", () => {
    // The whole bug in one assertion: the server passed its zones and the totals
    // helper dropped them, so pricing came from hardcoded Mumbai/Pune demo rows.
    const quote = calculateDeliveryQuote(
      { subtotal: 500, city: "Bengaluru", pincode: "560034" },
      commerce(),
      zones,
    );
    expect(quote.delivery).not.toBe(149); // not the fallback
    expect(quote.delivery).toBe(49);
  });

  it("charges the fallback when nothing matches", () => {
    const quote = calculateDeliveryQuote(
      { subtotal: 500, city: "Chennai", pincode: "600001" },
      commerce(),
      zones,
    );
    expect(quote.delivery).toBe(149);
  });

  it("honours a deliberately ZERO fallback instead of the flat fee", () => {
    // `||` treated 0 as unset and charged `deliveryFee` — the opposite of what
    // "deliver anywhere unmatched for free" asks for.
    const quote = calculateDeliveryQuote(
      { subtotal: 500, city: "Chennai", pincode: "600001" },
      commerce({ zoneFallbackDeliveryFee: 0 }),
      zones,
    );
    expect(quote.delivery).toBe(0);
  });

  it("keeps the zone's name and lead time when delivery is free", () => {
    // Free delivery used to return before the lookup, so the orders a shop most
    // wants to look confident about lost their zone and their estimate.
    const quote = calculateDeliveryQuote(
      { subtotal: 5000, city: "Bengaluru", pincode: "560034" },
      commerce(),
      zones,
    );
    expect(quote.delivery).toBe(0);
    expect(quote.zoneName).toBe("Zone");
    expect(quote.estimatedDeliveryDays).toBe(2);
  });

  it("charges the flat fee when zone pricing is switched off", () => {
    const quote = calculateDeliveryQuote(
      { subtotal: 500, city: "Bengaluru", pincode: "560034" },
      commerce({ useZoneBasedDelivery: false }),
      zones,
    );
    expect(quote.delivery).toBe(99);
    expect(quote.usedZonePricing).toBe(false);
  });
});
