import { describe, expect, it } from "vitest";

import { suggestPincodes } from "@/features/commerce/server/pincode-directory";
import { getPincodesController } from "@/features/commerce/server/commerce.controller";

/**
 * A PIN BOX LISTS REAL PINS AS THEY ARE TYPED.
 *
 * The owner's reference shop (2026-10-28): typing "3240" in the header's PIN
 * box lists "324001, Kota", "324002, Kota" … under it, to pick from. The list
 * comes from India Post's directory, so it never offers a PIN that does not
 * exist, and a typo lists nothing.
 */

describe("suggestPincodes", () => {
  it("lists the real PINs starting with the digits, lowest first, with their district", () => {
    const list = suggestPincodes("3240");
    expect(list.length).toBeGreaterThan(1);
    expect(list[0].pincode).toBe("324001");
    expect(list.every((place) => place.pincode.startsWith("3240"))).toBe(true);
    expect(list.map((place) => place.pincode)).toEqual([...list.map((place) => place.pincode)].sort());
    expect(list[0].districts).toContain("Kota");
  });

  it("stops at the limit, so three digits is a short list and not a hundred", () => {
    expect(suggestPincodes("324").length).toBe(10);
    expect(suggestPincodes("324", 4).length).toBe(4);
  });

  it("lists nothing for digits no PIN starts with — a typo shows itself", () => {
    expect(suggestPincodes("3249")).toEqual([]);
  });
});

describe("/api/pincodes?prefix=", () => {
  async function ask(query: string) {
    const res = await getPincodesController(new Request(`http://shop.test/api/pincodes?${query}`));
    return { status: res.status, body: (await res.json()) as { data?: { pincode: string }[] } };
  }

  it("answers the list for a prefix", async () => {
    const { status, body } = await ask("prefix=3240");
    expect(status).toBe(200);
    expect(body.data?.[0]?.pincode).toBe("324001");
  });

  it("refuses what is not a PIN prefix", async () => {
    for (const bad of ["32", "0324", "32a0", "3240011"]) {
      expect((await ask(`prefix=${bad}`)).status, bad).toBe(422);
    }
  });
});
