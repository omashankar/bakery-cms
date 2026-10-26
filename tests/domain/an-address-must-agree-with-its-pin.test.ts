import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addressPincodeConflict } from "@/features/commerce/server/address-pincode-check";

/**
 * AN ADDRESS MUST AGREE WITH ITS PIN.
 *
 * The owner's test order (2026-10-26): "royal sun city borkheda kota" at
 * 325601 — Borkheda is 324002, 325601 is Sangod, and the shop's only zone is
 * Sangod's. The PIN alone decided the zone, so the order was taken for Sangod
 * and would have been driven to Kota. The owner chose to refuse it.
 *
 * Every refusal stops a real customer, so the other half of this file is the
 * addresses that must still go through.
 */

const kota = { city: "Kota", state: "Rajasthan" };

describe("an address that names somewhere its PIN is not", () => {
  it("refuses Borkheda at Sangod's PIN, and says which PIN Borkheda is", () => {
    const conflict = addressPincodeConflict({
      pincode: "325601",
      addressLine1: "royal sun city borkheda kota",
      addressLine2: "borkheda kota",
      city: "kota",
      state: "Rajasthan",
    });
    expect(conflict).toContain("Borkheda");
    expect(conflict).toContain("324002");
    expect(conflict).toContain("Sangod");
  });

  it("takes the same address at Borkheda's own PIN", () => {
    expect(
      addressPincodeConflict({
        pincode: "324002",
        addressLine1: "royal sun city borkheda kota",
        addressLine2: "borkheda kota",
        ...kota,
      }),
    ).toBeNull();
  });

  it("reads a name however its spaces fall", () => {
    // India Post spells it "Ram Ganj Mandi".
    for (const line of ["Station Road, Ramganj Mandi", "Station Road Ramganjmandi"]) {
      expect(addressPincodeConflict({ pincode: "325601", addressLine1: line, ...kota })).toContain("326519");
    }
  });

  it("still sees an area whose name starts with the district's: Kota Jn", () => {
    expect(
      addressPincodeConflict({ pincode: "324001", addressLine1: "12 Shopping Centre, Kota Jn", ...kota }),
    ).toContain("324002");
  });

  it("refuses a state the PIN is not in", () => {
    expect(
      addressPincodeConflict({ pincode: "325601", addressLine1: "Ward 4", city: "Kota", state: "Gujarat" }),
    ).toContain("Rajasthan");
  });

  it("refuses a city that is a district of another state", () => {
    expect(addressPincodeConflict({ pincode: "325601", addressLine1: "Ward 4", city: "Bhopal" })).toContain(
      "Madhya Pradesh",
    );
  });
});

describe("an address that must still go through", () => {
  it("a colony India Post does not list — it proves nothing", () => {
    expect(addressPincodeConflict({ pincode: "325601", addressLine1: "royal sun city", ...kota })).toBeNull();
  });

  it("the PIN's own town, and a village with its tehsil and district", () => {
    expect(addressPincodeConflict({ pincode: "325601", addressLine1: "Ward 4, Sangod", ...kota })).toBeNull();
    expect(
      addressPincodeConflict({
        pincode: "325601",
        addressLine1: "Village Hingi, Tehsil Sangod",
        addressLine2: "Dist Kota",
        city: "Sangod",
        state: "Rajasthan",
      }),
    ).toBeNull();
  });

  it("the PIN's own area, even beside another's: the road to Kanwas runs through Sangod", () => {
    expect(addressPincodeConflict({ pincode: "325601", addressLine1: "Ward 4 Sangod Kanwas Road", ...kota })).toBeNull();
    // Kanwas alone is 325602.
    expect(addressPincodeConflict({ pincode: "325601", addressLine1: "Ward 4 Kanwas Road", ...kota })).toContain("325602");
  });

  it("a landmark in the next PIN", () => {
    expect(
      addressPincodeConflict({ pincode: "324001", addressLine1: "12 Shopping Centre, near Kota Jn", ...kota }),
    ).toBeNull();
  });

  it("'Kota City' at every Kota PIN, though 324006's office is called that", () => {
    for (const pincode of ["324001", "324002", "324005", "324006", "324009", "324010", "325601"]) {
      expect(
        addressPincodeConflict({ pincode, addressLine1: "Flat 2, Royal Society", addressLine2: "Kota City", ...kota }),
      ).toBeNull();
    }
  });

  it("a district's name that contains a town's: Devbhumi Dwarka is not Dwarka", () => {
    expect(
      addressPincodeConflict({
        pincode: "361305",
        addressLine1: "House 12, Shiv Colony",
        addressLine2: "Devbhumi Dwarka",
        city: "Devbhumi Dwarka",
        state: "Gujarat",
      }),
    ).toBeNull();
  });

  it("a metro's name over a PIN in the district next door", () => {
    expect(
      addressPincodeConflict({ pincode: "401107", addressLine1: "Mira Road East", city: "Mumbai", state: "Maharashtra" }),
    ).toBeNull();
  });

  it("a PIN India Post does not list — checkout lets it through", () => {
    expect(addressPincodeConflict({ pincode: "324099", addressLine1: "Borkheda", ...kota })).toBeNull();
  });
});

describe("pricing refuses the order, not just the check", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function loadPricing() {
    vi.doMock("@/features/products/server/product.repository", () => ({
      findBySlug: vi.fn(async () => ({ slug: "truffle", name: "Truffle", image: "/c.jpg", price: 999, category: "Cakes" })),
    }));
    vi.doMock("@/features/settings/server/settings.service", () => ({
      getSettings: vi.fn(async () => ({ commerce: { deliveryFee: 99, useZoneBasedDelivery: false } })),
    }));
    vi.doMock("@/features/commerce/server/commerce.service", () => ({
      getCoupons: vi.fn(async () => []),
      getZones: vi.fn(async () => []),
    }));
    return import("@/features/checkout/server/pricing.server");
  }

  const items = [{ productSlug: "truffle", quantity: 1 }];

  it("throws for a whole address that disagrees with its PIN", async () => {
    const { priceCart, AddressPincodeMismatchError } = await loadPricing();
    await expect(
      priceCart({
        items,
        deliveryAddress: { pincode: "325601", addressLine1: "royal sun city borkheda kota", ...kota },
      }),
    ).rejects.toBeInstanceOf(AddressPincodeMismatchError);
  });

  it("prices a PIN on its own — the running total has no street yet", async () => {
    const { priceCart } = await loadPricing();
    const quote = await priceCart({ items, deliveryAddress: { pincode: "325601", ...kota } });
    expect(quote.totals.subtotal).toBe(999);
  });
});
