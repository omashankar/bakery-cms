import { describe, expect, it } from "vitest";

import type { DeliveryZone } from "@/types/delivery";
import {
  filterDeliveryZones,
  findDeliveryZone,
  getUniqueZoneCities,
} from "@/features/commerce/lib/delivery-zone-utils";
import { lookUpDeliveryPincode } from "@/features/commerce/lib/delivery-location";
import {
  checkZoneDraft,
  explainPincode,
  readPincodeList,
  type ZoneDraft,
} from "@/features/commerce/lib/delivery-zone-validation";
import { deliveryZonesArraySchema } from "@/features/commerce/server/commerce.validators";

/**
 * A WRONG ZONE CANNOT BE SAVED, AND A HALF-TYPED PIN IS NOT AN ADDRESS.
 *
 * The owner asked (2026-10-22) for zones that are easy to add, that refuse to
 * save when they are wrong, and whose PIN-to-zone map works everywhere. What
 * was broken: five digits answered "Yes, we deliver"; the PIN box dropped
 * "Kota" and cut "3240012" to 324001 without a word; and two live zones could
 * both claim 324001, settled by a priority number nobody reads.
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
    minDeliveryDays: 0,
    estimatedDeliveryDays: 1,
    isActive: true,
    priority: 50,
    createdAt: "2026-10-22T00:00:00.000Z",
    updatedAt: "2026-10-22T00:00:00.000Z",
    ...patch,
  };
}

const kota = zone({ id: "kota", name: "Kota", coverage: "pincodes", pincodes: ["3240"], deliveryCharge: 99 });
const rules = { useZoneBasedDelivery: true, deliverOutsideZones: false, zoneFallbackDeliveryFee: 149, deliveryFee: 99 };
const money = (amount: number) => `₹${amount}`;

function draft(patch: Partial<DeliveryZone>, others: DeliveryZone[] = [], pins = "", out = ""): ZoneDraft {
  const { id, createdAt, updatedAt, ...data } = zone({ name: "New", coverage: "pincodes", ...patch });
  void createdAt;
  void updatedAt;
  const pincodeEntries = readPincodeList(pins);
  return {
    zone: { ...data, id, pincodes: pincodeEntries.map((e) => e.rule).filter(Boolean) },
    pincodeEntries,
    excludedEntries: readPincodeList(out),
    others,
  };
}

describe("a PIN is six digits before any zone answers it", () => {
  it("does not match five digits that a prefix rule starts with", () => {
    expect(findDeliveryZone([kota], { pincode: "32400" })).toBeNull();
    expect(findDeliveryZone([kota], { pincode: "3240" })).toBeNull();
    expect(findDeliveryZone([kota], { pincode: "324001" })?.zone.id).toBe("kota");
  });

  it("gives the storefront check no answer until the PIN is complete", () => {
    expect(lookUpDeliveryPincode([kota], "32400", rules)).toBeNull();
    expect(lookUpDeliveryPincode([kota], "324001", rules)?.served).toBe(true);
    expect(lookUpDeliveryPincode([kota], "400001", rules)?.served).toBe(false);
  });
});

describe("the PIN box keeps what it cannot read, and says so", () => {
  it.each([
    ["Kota", "is not a PIN code"],
    ["3240012", "more than 6 digits"],
    ["0324", "starts with 0"],
    ["32", "too short"],
  ])("refuses %s", (text, reason) => {
    const [entry] = readPincodeList(text);
    expect(entry.rule).toBe("");
    expect(entry.problem).toContain(reason);
  });

  it("reads a printed PIN with a space as one code, and a spaced list as many", () => {
    expect(readPincodeList("324 009").map((e) => e.rule)).toEqual(["324009"]);
    expect(readPincodeList("324001 324005, 3240\n3240").map((e) => e.rule)).toEqual([
      "324001",
      "324005",
      "3240",
    ]);
  });

  it("names the state each rule is in", () => {
    expect(readPincodeList("3240")[0].state).toBe("Rajasthan");
  });

  it("blocks saving while any entry is broken", () => {
    expect(checkZoneDraft(draft({}, [], "324001, Kota")).errors.join(" ")).toContain('"Kota" is not a PIN code');
  });
});

describe("one place belongs to one live zone", () => {
  it("refuses a PIN another live zone already has", () => {
    const { errors } = checkZoneDraft(draft({}, [kota], "3240"));
    expect(errors.join(" ")).toContain('already in "Kota"');
  });

  it("allows it when the other zone is switched off, or this one is", () => {
    expect(checkZoneDraft(draft({}, [{ ...kota, isActive: false }], "3240")).errors).toEqual([]);
    expect(checkZoneDraft(draft({ isActive: false }, [kota], "3240")).errors).toEqual([]);
  });

  it("allows a narrower PIN inside a broader zone, as a warning", () => {
    const { errors, warnings } = checkZoneDraft(draft({}, [kota], "324005"));
    expect(errors).toEqual([]);
    expect(warnings.join(" ")).toContain('overlaps "Kota"');
  });

  it("refuses the same state, the same city, a second all-India zone and a repeated name", () => {
    const raj = zone({ name: "Rajasthan", coverage: "states", states: ["Rajasthan"] });
    expect(checkZoneDraft(draft({ coverage: "states", states: ["Rajasthan"] }, [raj])).errors.join(" ")).toContain(
      "already in",
    );
    const city = zone({ name: "Kota city", coverage: "cities", cities: ["Kota"] });
    expect(checkZoneDraft(draft({ coverage: "cities", cities: ["kota "] }, [city])).errors.join(" ")).toContain(
      "already in",
    );
    const india = zone({ name: "India", coverage: "country" });
    expect(checkZoneDraft(draft({ coverage: "country" }, [india])).errors.join(" ")).toContain("all of India");
    expect(checkZoneDraft(draft({ name: "kota" }, [kota], "325")).errors.join(" ")).toContain("already called");
  });
});

describe("a zone that would deliver nowhere is refused", () => {
  it("refuses a leave-out list that swallows every rule", () => {
    expect(checkZoneDraft(draft({}, [], "324001, 324005", "3240")).errors.join(" ")).toContain("deliver nowhere");
  });

  it("warns when a leave-out is not inside the zone at all", () => {
    expect(checkZoneDraft(draft({}, [], "3240", "400001")).warnings.join(" ")).toContain("changes nothing");
  });

  it("refuses a PIN typed into the cities box", () => {
    expect(checkZoneDraft(draft({ coverage: "cities", cities: ["324001"] })).errors.join(" ")).toContain(
      "is a PIN code, not a city",
    );
  });

  it("says blank fields are missing, not wrong", () => {
    const problems = checkZoneDraft(draft({ name: "" }));
    expect(problems.errors).toEqual([]);
    expect(problems.missing).toEqual(["Give the zone a name.", "Add at least one PIN code or PIN prefix."]);
  });
});

describe("the admin's PIN checker answers what checkout will do", () => {
  it("names the winner and the zones it beat", () => {
    const area = zone({ id: "area", name: "Kota Central", coverage: "pincodes", pincodes: ["324005"] });
    const verdict = explainPincode([kota, area], "324005", rules, money);
    expect(verdict?.winner?.zone.id).toBe("area");
    expect(verdict?.alsoCovered.map((m) => m.zone.id)).toEqual(["kota"]);
  });

  it("says checkout refuses a PIN outside every zone when the shop stops there", () => {
    expect(explainPincode([kota], "400001", rules, money)).toMatchObject({ delivered: false });
    expect(explainPincode([kota], "400001", { ...rules, deliverOutsideZones: true }, money)?.outcome).toContain(
      "₹149",
    );
  });
});

describe("the zone list finds zones by what they cover", () => {
  const cities = zone({ name: "Hadoti", coverage: "cities", cities: ["Kota", "Bundi"], city: "Kota, Bundi" });
  const all = { search: "", status: "all" as const, city: "all" };

  it("searches a zone's PIN rules and cities, not only the old single fields", () => {
    expect(filterDeliveryZones([kota, cities], { ...all, search: "3240" }).map((z) => z.name)).toEqual(["Kota"]);
    expect(filterDeliveryZones([kota, cities], { ...all, search: "bundi" }).map((z) => z.name)).toEqual(["Hadoti"]);
  });

  it("counts real cities, one each, and filters on any of them", () => {
    expect(getUniqueZoneCities([kota, cities])).toEqual(["Bundi", "Kota"]);
    expect(filterDeliveryZones([kota, cities], { ...all, city: "Bundi" }).map((z) => z.name)).toEqual(["Hadoti"]);
  });
});

describe("the server refuses what the form refuses", () => {
  it.each([["0324"], ["32"], ["3240012"]])("rejects the PIN rule %s", (rule) => {
    expect(deliveryZonesArraySchema.safeParse([{ ...kota, pincodes: [rule] }]).success).toBe(false);
  });

  it("rejects a PIN-code zone with no PIN codes", () => {
    expect(deliveryZonesArraySchema.safeParse([{ ...kota, pincodes: [] }]).success).toBe(false);
    expect(deliveryZonesArraySchema.safeParse([kota]).success).toBe(true);
  });
});
