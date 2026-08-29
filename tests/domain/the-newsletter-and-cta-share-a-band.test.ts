/**
 * Where the newsletter and the CTA end up on the page.
 *
 * The storefront renders these two as ONE band, side by side, at whichever of
 * them comes first — and drops the later one from its own slot. That rule lived
 * inline in apps/website/pages/store-home-content.tsx, so the builder preview
 * knew nothing about it and drew each full-width where it sat. An admin who
 * dragged the CTA to the bottom of the page saw it at the bottom, published, and
 * got it beside the newsletter halfway up.
 *
 * The rule is now one function that both surfaces call. This pins what it
 * decides, because the pairing is only correct if BOTH sides agree on which
 * section anchors the band — get that backwards and the two sections swap
 * places between the preview and the published page.
 */
import { describe, expect, it } from "vitest";

import { planNewsletterCtaPair } from "@/features/cms-sections/lib/section-utils";

function section(instanceId: string, type: string) {
  return { instanceId, type };
}

const NEWSLETTER = section("n1", "newsletter");
const CTA = section("c1", "cta");
const HERO = section("h1", "hero");
const GALLERY = section("g1", "gallery");

describe("pairing the newsletter with the CTA", () => {
  it("anchors the band at the newsletter when it comes first", () => {
    const pair = planNewsletterCtaPair([HERO, NEWSLETTER, GALLERY, CTA]);

    expect(pair).not.toBeNull();
    expect(pair!.anchorId).toBe("n1");
    expect(pair!.otherId).toBe("c1");
  });

  it("anchors it at the CTA when THAT comes first", () => {
    // The half the admin dragged upward is the one that decides where the band
    // sits. Hard-coding the newsletter as the anchor would move the band on
    // publish for every shop that reordered them.
    const pair = planNewsletterCtaPair([HERO, CTA, GALLERY, NEWSLETTER]);

    expect(pair!.anchorId).toBe("c1");
    expect(pair!.otherId).toBe("n1");
  });

  it("always reports which half is which, whatever the order", () => {
    // The band renders newsletter-then-CTA left to right regardless of which
    // one anchors it, so these must not follow document order.
    for (const list of [
      [NEWSLETTER, CTA],
      [CTA, NEWSLETTER],
    ]) {
      const pair = planNewsletterCtaPair(list);
      expect(pair!.newsletter.instanceId).toBe("n1");
      expect(pair!.cta.instanceId).toBe("c1");
    }
  });

  it("does not pair when only one of them is on the page", () => {
    // Half a band is worse than none: the survivor would be dropped from its own
    // slot and never rendered.
    expect(planNewsletterCtaPair([HERO, NEWSLETTER, GALLERY])).toBeNull();
    expect(planNewsletterCtaPair([HERO, CTA, GALLERY])).toBeNull();
    expect(planNewsletterCtaPair([HERO, GALLERY])).toBeNull();
    expect(planNewsletterCtaPair([])).toBeNull();
  });

  it("pairs the FIRST of each when a section is duplicated", () => {
    // The builder's Duplicate button makes this reachable, and two anchors would
    // render the band twice.
    const pair = planNewsletterCtaPair([
      NEWSLETTER,
      section("n2", "newsletter"),
      CTA,
      section("c2", "cta"),
    ]);

    expect(pair!.newsletter.instanceId).toBe("n1");
    expect(pair!.cta.instanceId).toBe("c1");
    expect(pair!.anchorId).toBe("n1");
  });
});
