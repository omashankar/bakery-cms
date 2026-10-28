import { describe, expect, it } from "vitest";

import type { DeliveryZone } from "@/types/delivery";
import type { CommerceSettings } from "@/types/settings";
import {
  describeZoneCoverage,
  findDeliveryZone,
} from "@/features/commerce/lib/delivery-zone-utils";
import { lookUpDeliveryPincode } from "@/features/commerce/lib/delivery-location";
import { calculateDeliveryQuote } from "@/features/orders/lib/delivery-pricing";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import { matchStateName, stateForPincode } from "@/features/commerce/lib/india-states";

/**
 * A ZONE COVERS WHAT THE SHOP CHOOSES: all of India, whole states, named
 * cities, or chosen PIN codes — and can leave places out.
 *
 * A zone used to be one city and one PIN rule. A shop delivering across
 * Rajasthan needed a zone per PIN prefix; one delivering to five areas of a
 * city could not say so in one zone; and nothing could say "everywhere in
 * Kota except this one PIN".
 */

let n = 0;
function zone(patch: Partial<DeliveryZone>): DeliveryZone {
  n += 1;
  return {
    id: `z${n}`,
    name: `Zone ${n}`,
    city: "",
    pincode: "",
    radiusKm: 0,
    deliveryCharge: 100,
    minDeliveryDays: 1,
    estimatedDeliveryDays: 2,
    isActive: true,
    priority: 50,
    createdAt: "",
    updatedAt: "",
    ...patch,
  };
}

const india = zone({ name: "India", coverage: "country", deliveryCharge: 300 });
const rajasthan = zone({ name: "Rajasthan", coverage: "states", states: ["Rajasthan"], deliveryCharge: 150 });
const kotaCity = zone({ name: "Kota city", coverage: "cities", cities: ["Kota", "Bundi"], deliveryCharge: 80 });
const kotaAreas = zone({
  name: "Kota centre",
  coverage: "pincodes",
  pincodes: ["324005", "3240"],
  excludedPincodes: ["324009"],
  deliveryCharge: 40,
});
const all = [india, rajasthan, kotaCity, kotaAreas];

describe("what each kind of zone covers", () => {
  it("all of India answers any address", () => {
    expect(findDeliveryZone([india], { pincode: "560001" })?.zone.id).toBe(india.id);
    expect(findDeliveryZone([india], { city: "Anywhere" })?.matchType).toBe("country");
  });

  it("but not an address with nothing in it", () => {
    expect(findDeliveryZone([india], {})).toBeNull();
  });

  it("a state zone answers every PIN in that state, from the PIN alone", () => {
    expect(findDeliveryZone([rajasthan], { pincode: "302001" })?.zone.id).toBe(rajasthan.id);
    expect(findDeliveryZone([rajasthan], { pincode: "302001" })?.matchType).toBe("state");
    expect(findDeliveryZone([rajasthan], { pincode: "380001" })).toBeNull();
  });

  it("the PIN decides the state, not what the customer typed in the State box", () => {
    expect(findDeliveryZone([rajasthan], { pincode: "380001", state: "Rajasthan" })).toBeNull();
    // With no PIN at all, the typed name is all there is.
    expect(findDeliveryZone([rajasthan], { city: "Jaipur", state: "rajasthan" })?.zone.id).toBe(rajasthan.id);
  });

  it("a city zone answers each of its cities, ignoring capitals", () => {
    expect(findDeliveryZone([kotaCity], { city: "BUNDI" })?.zone.id).toBe(kotaCity.id);
    expect(findDeliveryZone([kotaCity], { city: "Jaipur" })).toBeNull();
  });

  it("a PIN-code zone answers its exact PINs and its prefixes", () => {
    expect(findDeliveryZone([kotaAreas], { pincode: "324005" })?.zone.id).toBe(kotaAreas.id);
    expect(findDeliveryZone([kotaAreas], { pincode: "324010" })?.zone.id).toBe(kotaAreas.id);
    expect(findDeliveryZone([kotaAreas], { pincode: "324110" })).toBeNull();
  });
});

describe("leaving places out", () => {
  it("a left-out PIN is not covered, even inside the zone's prefix", () => {
    expect(findDeliveryZone([kotaAreas], { pincode: "324009" })).toBeNull();
  });

  it("and falls through to the next zone that does cover it", () => {
    expect(findDeliveryZone(all, { pincode: "324009", city: "Kota" })?.zone.id).toBe(kotaCity.id);
  });

  it("a prefix can be left out of a whole state", () => {
    const rajasthanButNotKota = zone({
      coverage: "states",
      states: ["Rajasthan"],
      excludedPincodes: ["324"],
    });
    expect(findDeliveryZone([rajasthanButNotKota], { pincode: "324005" })).toBeNull();
    expect(findDeliveryZone([rajasthanButNotKota], { pincode: "302001" })).not.toBeNull();
  });
});

describe("the narrowest zone wins, whatever it charges", () => {
  it("PIN over city over state over country", () => {
    expect(findDeliveryZone(all, { pincode: "324005", city: "Kota" })?.zone.id).toBe(kotaAreas.id);
    expect(findDeliveryZone(all, { pincode: "324110", city: "Kota" })?.zone.id).toBe(kotaCity.id);
    expect(findDeliveryZone(all, { pincode: "302001", city: "Jaipur" })?.zone.id).toBe(rajasthan.id);
    expect(findDeliveryZone(all, { pincode: "560001", city: "Bengaluru" })?.zone.id).toBe(india.id);
  });

  it("a cheap wide zone does not outbid a dearer narrow one", () => {
    const cheapIndia = zone({ coverage: "country", deliveryCharge: 0 });
    expect(findDeliveryZone([cheapIndia, rajasthan], { pincode: "302001" })?.zone.id).toBe(rajasthan.id);
  });

  it("an inactive zone covers nothing", () => {
    const off = zone({ coverage: "country", isActive: false });
    expect(findDeliveryZone([off], { pincode: "302001" })).toBeNull();
  });
});

describe("outside every zone", () => {
  const rules = (patch: Partial<CommerceSettings>): CommerceSettings => ({
    ...defaultCommerceSettings,
    useZoneBasedDelivery: true,
    zoneFallbackDeliveryFee: 199,
    freeDeliveryThreshold: 100000,
    ...patch,
  });

  it("is delivered at the fallback fee when the shop says so, and the product page agrees", () => {
    const quote = calculateDeliveryQuote({ subtotal: 500, pincode: "560001" }, rules({ deliverOutsideZones: true }), [kotaAreas]);
    expect(quote).toMatchObject({ deliverable: true, delivery: 199 });
    expect(lookUpDeliveryPincode([kotaAreas], "560001", rules({ deliverOutsideZones: true }))).toMatchObject({
      served: true,
      charge: 199,
    });
  });

  it("is refused when the shop delivers only inside its zones, and the product page agrees", () => {
    // A pin in Bengaluru, which no area of this shop holds.
    const quote = calculateDeliveryQuote(
      { subtotal: 500, pincode: "560001", location: { lat: 12.97, lng: 77.59 } },
      rules({ deliverOutsideZones: false }),
      [kotaAreas],
    );
    expect(quote.deliverable).toBe(false);
    expect(lookUpDeliveryPincode([kotaAreas], "560001", rules({ deliverOutsideZones: false }))?.served).toBe(false);
  });

  it("is never refused before there is an address to refuse", () => {
    const quote = calculateDeliveryQuote({ subtotal: 500 }, rules({ deliverOutsideZones: false }), [kotaAreas]);
    expect(quote.deliverable).toBe(true);
  });

  it("settings saved before the switch existed keep delivering", () => {
    const old = rules({});
    delete (old as Partial<CommerceSettings>).deliverOutsideZones;
    expect(
      calculateDeliveryQuote({ subtotal: 500, pincode: "560001", location: { lat: 12.97, lng: 77.59 } }, old, [kotaAreas])
        .deliverable,
    ).toBe(true);
  });

  it("with zones switched off the product page says every PIN is delivered at the flat fee", () => {
    expect(
      lookUpDeliveryPincode([kotaAreas], "560001", rules({ useZoneBasedDelivery: false, deliveryFee: 49 })),
    ).toMatchObject({ served: true, charge: 49 });
  });
});

describe("the state of a PIN code", () => {
  it.each([
    ["324005", "Rajasthan"],
    ["110001", "Delhi"],
    ["403001", "Goa"],
    ["400001", "Maharashtra"],
    ["560001", "Karnataka"],
    ["160017", "Chandigarh"],
    ["605001", "Puducherry"],
    ["605602", "Tamil Nadu"],
    ["682551", "Lakshadweep"],
    ["682001", "Kerala"],
    ["737101", "Sikkim"],
    ["744101", "Andaman and Nicobar Islands"],
    ["834001", "Jharkhand"],
    ["800001", "Bihar"],
    ["500001", "Telangana"],
    ["530001", "Andhra Pradesh"],
    ["248001", "Uttarakhand"],
    ["247001", "Uttar Pradesh"],
    ["396001", "Gujarat"],
    ["396230", "Dadra and Nagar Haveli and Daman and Diu"],
    ["194101", "Ladakh"],
    ["190001", "Jammu and Kashmir"],
    ["781001", "Assam"],
    ["799001", "Tripura"],
  ])("%s is in %s", (pin, state) => {
    expect(stateForPincode(pin)).toBe(state);
  });

  it("is unknown for something that is not a PIN", () => {
    expect(stateForPincode("12")).toBeNull();
    expect(stateForPincode("999999")).toBeNull();
  });

  it("reads typed names and common short forms", () => {
    expect(matchStateName("  rajasthan ")).toBe("Rajasthan");
    expect(matchStateName("Orissa")).toBe("Odisha");
    expect(matchStateName("UP")).toBe("Uttar Pradesh");
    expect(matchStateName("Narnia")).toBeNull();
  });
});

describe("a zone described in words", () => {
  it("says what it covers and what it leaves out", () => {
    expect(describeZoneCoverage(kotaAreas)).toEqual({
      covers: "PIN codes: 324005, 3240…",
      except: "324009",
    });
    expect(describeZoneCoverage(india).covers).toBe("All of India");
    expect(describeZoneCoverage(zone({ city: "Pune", pincode: "411" })).covers).toBe("PIN 411… · Pune");
  });
});

describe("a zone stored twice", () => {
  it("is read once, as the copy saves reach", async () => {
    const { onePerId } = await import("@/features/commerce/server/commerce.repository");
    const { Types } = await import("mongoose");
    const hex = "6ab10ecd09fe244839f47f5c";
    const docs = [
      { _id: "zone-a", name: "A" },
      { _id: new Types.ObjectId(hex), name: "Kota (stale twin)" },
      { _id: hex, name: "Kota" },
    ];
    expect(onePerId(docs).map((doc) => doc.name)).toEqual(["A", "Kota"]);
  });
});
