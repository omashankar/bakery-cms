import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { chosen } from "@/apps/website/lib/shipped-placeholder";
import { brandInfo } from "@/constants/landing-data";

/**
 * THE FOOTER SAYS ONLY WHAT THE SHOP SAID.
 *
 * It sits under every customer page — the storefront, the checkout, the
 * account area, the 404 — so a sentence this software puts there is published
 * under the shop's own logo on all of them.
 *
 * ONE WAS. The brand blurb read `general.siteDescription || brandInfo.description`,
 * and `defaultGeneralSettings` is CREATED holding that same sentence — so the
 * fallback was never reached and never needed to be: the STORED value was the
 * shipped one. Every shop that had not rewritten the box published "Freshly
 * baked cakes, pastries and confections, made to order." as its own, including
 * the florists and gift shops `businessType: "other"` exists to serve.
 *
 * `chosen()` already solved exactly this for the address, the phone and the
 * opening hours. The blurb and the tagline were left on `||`.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const FOOTER = "apps/website/landing/components/landing-footer.tsx";
const CHROME = "apps/website/lib/storefront-chrome.server.ts";

const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("the footer says only what the shop said", () => {
  it("treats the shipped blurb as a placeholder, not as an answer", () => {
    /*
      The rule itself, exercised rather than read: the shipped sentence going
      in comes back as nothing, and a shop's own sentence comes back whole.
    */
    expect(chosen(brandInfo.description, brandInfo.description)).toBe("");
    expect(chosen("", brandInfo.description)).toBe("");
    expect(chosen("  ", brandInfo.description)).toBe("");
    expect(chosen("Fresh flowers, cut this morning.", brandInfo.description)).toBe(
      "Fresh flowers, cut this morning.",
    );
  });

  it("and the chrome resolves the blurb and the tagline through it", () => {
    const src = codeOf(read(CHROME));

    expect(src, "the tagline falls back to the shipped one").toContain(
      "tagline: chosen(general.siteTagline, brandInfo.tagline)",
    );
    expect(src, "the blurb falls back to the shipped one").toContain(
      "description: chosen(general.siteDescription, brandInfo.description)",
    );
    expect(
      src.includes("general.siteDescription || brandInfo.description"),
      "the `||` fallback is back",
    ).toBe(false);
  });

  it("and the footer draws nothing at all for a shop that wrote none", () => {
    // An empty <p> under a logo is a gap that reads as a missing sentence.
    const body = codeOf(read(FOOTER));

    expect(body, "a blank blurb still draws its paragraph").toContain(
      "{brandInfo.description ? (",
    );
  });

  it("and its phone and email can be used from a phone", () => {
    /*
      They were printed as text, so a customer reading the footer on a phone —
      which is most of them — had to select a number by hand and paste it into
      the dialler.

      The address stays text on purpose: a map lives on the Contact page, and
      building a `geo:` URL out of a typed line is a guess.
    */
    const body = codeOf(read(FOOTER));

    expect(body, "the phone is not dialable").toContain("href={`tel:${");
    expect(body, "the email is not mailable").toContain("href={`mailto:${");
    expect(body.includes("href={`geo:"), "the address is being guessed at").toBe(false);
  });

  it("and its columns wrap rather than overflowing a fixed twelve", () => {
    /*
      The grid was `lg:grid-cols-12` with fixed spans — brand 4, then 2 apiece
      — which sums to exactly 12 for the two link columns that ship. The admin
      lets a shop add a third freely, and three link columns make the row 14
      wide in a 12-wide grid.

      And `lg` was the only breakpoint, so everything from a 640px phone to a
      1023px tablet got one tall stacked column. Measured after the change:
      two across from 640, four from 1024, and a fifth block starting a second
      row with every block still the same width.
    */
    const body = codeOf(read(FOOTER));

    expect(body.includes("lg:grid-cols-12"), "the fixed twelve is back").toBe(false);
    expect(body.includes("lg:col-span-2"), "fixed spans are back").toBe(false);
    expect(body, "there is no tablet step").toContain("sm:grid-cols-2");
    expect(body, "the blocks do not flow into four").toContain("lg:grid-cols-4");
  });
});
