import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { infoBarFrom } from "@/apps/website/lib/storefront-chrome.server";
import { StorefrontInfoBar } from "@/apps/website/components/storefront-info-bar";
import { headerSchema } from "@/features/site-layout/server/site-layout.validators";
import { defaultHeaderSettings } from "@/features/site-layout/lib/header-utils";

/**
 * THE INFO BAR ABOVE THE LOGO SAYS ONLY WHAT THE SHOP WROTE.
 *
 * The shop's header design (2026-10-23) puts a brand-coloured bar above the
 * logo: short lines on the left, phone and place on the right. A row like it
 * was removed once before because it said something the shop never chose
 * ("Currency · INR"). So: nothing is shipped in it, it is off until switched
 * on, the phone is the one in Contact, and an empty bar draws nothing.
 */

const PHONE = "+91 88246 75118";
const on = { show: true, points: ["Freshly Baked", "Same Day Delivery"], showPhone: true, location: "Kota, Rajasthan" };

describe("what the bar draws", () => {
  it("is nothing for a fresh shop", () => {
    expect(defaultHeaderSettings.infoBar?.show).toBe(false);
    expect(defaultHeaderSettings.infoBar?.points).toEqual([]);
    expect(infoBarFrom(defaultHeaderSettings.infoBar, PHONE)).toBeNull();
  });

  it("is nothing when switched off, whatever it holds", () => {
    expect(infoBarFrom({ ...on, show: false }, PHONE)).toBeNull();
  });

  it("is nothing when switched on with nothing in it", () => {
    expect(infoBarFrom({ show: true, points: [" "], showPhone: false, location: "" }, PHONE)).toBeNull();
  });

  it("takes the phone from Contact, and only when asked to", () => {
    expect(infoBarFrom(on, PHONE)).toEqual({ points: on.points, phone: PHONE, location: "Kota, Rajasthan" });
    expect(infoBarFrom({ ...on, showPhone: false }, PHONE)?.phone).toBe("");
  });

  it("renders the shop's lines, a dialable phone and the place", () => {
    const html = renderToStaticMarkup(
      createElement(StorefrontInfoBar, { bar: { points: on.points, phone: PHONE, location: "Kota, Rajasthan" } }),
    );
    expect(html).toContain("Freshly Baked");
    expect(html).toContain("Same Day Delivery");
    expect(html).toContain('href="tel:+918824675118"');
    expect(html).toContain("Kota, Rajasthan");
  });
});

describe("what the Header screen may save", () => {
  const base = { logoLetter: "S", nav: [] };

  it("drops a blank line instead of refusing the save", () => {
    const parsed = headerSchema.parse({ ...base, infoBar: { ...on, points: ["Freshly Baked", "", "  "] } });
    expect(parsed.infoBar?.points).toEqual(["Freshly Baked"]);
  });

  it("refuses a line too long for a one-line bar, and a fifth line", () => {
    expect(headerSchema.safeParse({ ...base, infoBar: { ...on, points: ["x".repeat(41)] } }).success).toBe(false);
    expect(headerSchema.safeParse({ ...base, infoBar: { ...on, points: ["a", "b", "c", "d", "e"] } }).success).toBe(false);
  });
});
