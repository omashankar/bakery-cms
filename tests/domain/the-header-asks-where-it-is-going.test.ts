import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  deliveryLocationLabel,
  lookUpDeliveryPincode,
} from "@/features/commerce/lib/delivery-location";
import type { DeliveryZone } from "@/types/delivery";

/**
 * WHERE THE ORDER IS GOING, ASKED IN THE HEADER.
 *
 * The reference storefront carries this beside the search box, because it
 * changes what the rest of the page means: a price with no delivery charge in
 * it and a promise with no zone behind it are both answers to a question nobody
 * has asked yet.
 *
 * Every case here is about the same rule. This control states no coverage, no
 * speed and no cost of its own — everything it says was typed into Commerce →
 * Delivery Zones by the shop, and where the shop has said nothing the control
 * says nothing rather than guessing in either direction.
 */
const read = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8")
    .split(String.fromCharCode(13, 10))
    .join(String.fromCharCode(10));
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

const BUTTON = "apps/website/components/delivery-location-button.tsx";
const NAVBAR = "apps/website/components/storefront-navbar.tsx";
const CHROME = "apps/website/lib/storefront-chrome.server.ts";

const zone = (over: Partial<DeliveryZone>): DeliveryZone =>
  ({
    id: "z1",
    name: "Kota City",
    city: "Kota",
    pincode: "324",
    radiusKm: 10,
    deliveryCharge: 40,
    minDeliveryDays: 1,
    estimatedDeliveryDays: 2,
    isActive: true,
    priority: 0,
    ...over,
  }) as DeliveryZone;

describe("what the shop's zones say about a PIN code", () => {
  it("says nothing at all until something usable is typed", () => {
    /**
     * Null is a THIRD answer, and collapsing it into "not served" is how a
     * customer gets told a shop does not deliver to them before they have
     * finished typing.
     */
    expect(lookUpDeliveryPincode([zone({})], "")).toBeNull();
    expect(lookUpDeliveryPincode([zone({})], "   ")).toBeNull();
    expect(lookUpDeliveryPincode([zone({})], "abc")).toBeNull();
  });

  it("repeats the matched zone's own name, days and charge", () => {
    const found = lookUpDeliveryPincode([zone({})], "324001");

    expect(found).toEqual({
      served: true,
      zoneName: "Kota City",
      minDeliveryDays: 1,
      charge: 40,
    });
  });

  it("keeps a zone that delivers today, rather than reading 0 as nothing", () => {
    // 0 is same-day — the fastest thing a shop can configure — and a truthy
    // check would drop exactly that value and print no line at all.
    expect(lookUpDeliveryPincode([zone({ minDeliveryDays: 0 })], "324001")?.minDeliveryDays).toBe(
      0,
    );
    expect(lookUpDeliveryPincode([zone({ deliveryCharge: 0 })], "324001")?.charge).toBe(0);
  });

  it("does not count a zone the shop has switched off", () => {
    const found = lookUpDeliveryPincode([zone({ isActive: false })], "324001");
    expect(found).toEqual({ served: false, zoneName: "", minDeliveryDays: null, charge: null });
  });

  it("and says only that nothing covers it, when nothing does", () => {
    const found = lookUpDeliveryPincode([zone({})], "110001");
    expect(found?.served).toBe(false);
    // No name, no days, no charge invented to fill the panel.
    expect(found?.zoneName).toBe("");
    expect(found?.minDeliveryDays).toBeNull();
    expect(found?.charge).toBeNull();
  });
});

describe("the button's own line", () => {
  it("is nothing before a choice is made", () => {
    // The caller renders its own prompt then. A default here would be this
    // module naming a place the shop may not deliver to.
    expect(deliveryLocationLabel(null)).toBe("");
  });

  it("is the zone's name, and the PIN code when the shop left it unnamed", () => {
    expect(deliveryLocationLabel({ pincode: "324001", label: "Kota City" })).toBe("Kota City");
    expect(deliveryLocationLabel({ pincode: "324001", label: "" })).toBe("324001");
  });
});

describe("when the control appears at all", () => {
  it("not when the shop has configured no delivery zone", () => {
    /**
     * The difference between "we do not deliver there" and "nobody has said
     * yet". With no zones the only answer the panel could ever give is the
     * first — and a shop that would happily take that order by phone is being
     * called a liar by its own header.
     */
    const navbar = code(NAVBAR);
    expect(navbar).toMatch(/\{chrome\.hasDeliveryZones \? \(/);
  });

  it("and not when the zones could not be read", () => {
    // Same rule the rest of the chrome follows for a read it could not make:
    // show nothing rather than something that might not be true.
    const chrome = code(CHROME);
    const helper = chrome.slice(chrome.indexOf("async function hasActiveDeliveryZones"));

    expect(helper.slice(0, 300)).toContain("getPublicZones()");
    expect(helper.slice(0, 300)).toMatch(/catch \{\s*return false;/);
  });

  it("and the fallback chrome says no, for the same reason", () => {
    const chrome = code(CHROME);
    const fallback = chrome.slice(
      chrome.indexOf("function fallbackChrome"),
      chrome.indexOf("export const getStorefrontChrome"),
    );

    expect(fallback).toContain("hasDeliveryZones: false");
  });
});

describe("what the panel costs a visitor who never opens it", () => {
  it("nothing: the zone list is fetched when it opens", () => {
    /**
     * This sits in the header of every storefront page. Fetching on mount
     * would put an extra request on every page load of every visit, for a
     * control most visitors never touch.
     */
    const button = code(BUTTON);
    const opener = button.slice(button.indexOf("const openPanel"));

    expect(opener.slice(0, 400), "the zone list is not fetched when the panel opens").toContain(
      "fetchZones()",
    );
    // And nowhere else: an effect that fetched on mount would put the request
    // back on every page load of every visit.
    expect((button.match(/fetchZones\(\)/g) ?? []).length).toBe(1);
    expect(opener.slice(0, 200)).toContain("if (zones !== null || loading) return;");
  });

  it("and a failed fetch does not turn into a refusal", () => {
    // An empty list on failure means the panel says it found no covering zone
    // rather than claiming the shop does not deliver — but the two must not be
    // the same sentence, so the empty list is deliberate and commented.
    const button = code(BUTTON);
    expect(button).toMatch(/\.catch\(\(\) => setZones\(\[\]\)\)/);
  });
});

describe("the search box", () => {
  it("starts at the first width that can hold one", () => {
    const navbar = code(NAVBAR);
    const form = navbar.slice(navbar.indexOf("<form"), navbar.indexOf("</form>"));

    expect(form).toContain("sm:flex");
    expect(form, "the box starts at lg again").not.toContain("lg:flex");
  });

  it("and the shop name cannot push the icons off the row", () => {
    /**
     * The name is free text of any length and the logo link is the flex child
     * that grows. A long one pushed the cart and the menu button off a phone
     * entirely — there is no horizontal scroll on a sticky header, so they were
     * simply gone.
     */
    const navbar = code(NAVBAR);
    const logo = navbar.slice(navbar.indexOf("href={routes.store.home}"));

    expect(logo.slice(0, 300)).toContain("min-w-0");
    expect(logo.slice(0, 300)).toMatch(/max-w-\[/);
  });
});

describe("the category tiles", () => {
  const strip = () => {
    const renderer = code("features/cms-sections/homepage-section-renderer.tsx");
    const at = renderer.indexOf("function OurMenuSection");
    const rest = renderer.slice(at + 1);
    const next = rest.search(/\n(?:export )?(?:function|const) /);
    return next < 0 ? rest : rest.slice(0, next);
  };

  /**
   * THE TILE'S OWN CLASS STRING, found by the one thing about it that is not
   * a style choice: its width. Three tests used to locate it by the literal
   * "rounded-2xl bg-cream-", and all three broke the day a class was inserted
   * between those two — for a tile that was still perfectly correct. A guard
   * that fails on class ORDER is testing the author's typing.
   */
  const tileClasses = () => {
    const found = strip().match(/"group flex w-\[5\.5rem\][^"]*"/);
    expect(found, "the category tile is gone").toBeTruthy();
    return found![0];
  };

  it("hold the category name inside the card, not floating under it", () => {
    /**
     * The name sat outside the bordered box. So the tile was a picture with a
     * caption beneath rather than one object, and a two-line name pushed its
     * neighbours out of alignment. Asserted by ORDER: the tile opens before
     * the name and the name is inside it.
     *
     * Found by the tile's WIDTH, which is the one thing about its class
     * string that is not a style choice. Locating it by a slice of that
     * string broke this the day a class was inserted into the middle of it.
     */
    const body = strip();
    const card = body.indexOf(tileClasses());
    const name = body.indexOf("{category.name}", card);

    expect(card, "the tile is gone").toBeGreaterThan(-1);
    expect(name, "the name is not inside the card").toBeGreaterThan(card);
    expect(body.slice(card, name), "the card closes before the name").not.toContain("</Link>");
  });

  it("take as many columns as there are tiles", () => {
    // Hard-wired to eight, so a shop with three categories got three cards and
    // five columns of air.
    const body = strip();
    expect(body).toMatch(/items\.length <= 4 && "lg:grid-cols-4"/);
    expect(body).toMatch(/items\.length >= 8 && "lg:grid-cols-8"/);
  });

  it("ask the browser for a source the size they are painted at", () => {
    /**
     * `120px` was right only in the eight-across case. At a 1023px viewport the
     * four-column grid paints these at about 225px, so every tablet was asking
     * for a source under half the painted width and getting soft tiles.
     */
    const body = strip();
    expect(body, "the tiles ask for one fixed size again").not.toContain('sizes="120px"');
    expect(body).toContain("(min-width: 640px) 25vw");
  });

  it("and the phone row runs to the edge of the screen", () => {
    // Stopping 16px short is what hides the fact that there is more to the
    // right — the gutter has to be negated and re-applied as padding.
    const body = strip();
    expect(body).toContain("-mx-4");
    expect(body).toContain("sm:mx-0");
  });
});
