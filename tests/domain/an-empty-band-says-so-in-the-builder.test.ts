/**
 * AN EMPTY BAND SAYS SO IN THE BUILDER — AND ONLY THERE.
 *
 * A band with nothing to show is left off the live homepage, which is right
 * for a customer. Nine band types were left off the BUILDER too: they returned
 * `null`, so a section switched on drew no element at all, a click on it in
 * the list scrolled to nothing, and the shop could not tell an empty band from
 * a broken one. This shop's "Shop by category" vanished from its live page
 * (none of its categories had a picture yet) with no sign of it anywhere.
 *
 * Walked over the WHOLE registry, so a band type added later is held to the
 * same rule without anybody remembering to add it here.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HOMEPAGE_SECTION_REGISTRY } from "@/constants/section-registry";
import { HomepageSectionRenderer } from "@/features/cms-sections/homepage-section-renderer";
import type { HomepageSectionInstance, SectionBackground } from "@/types/homepage-builder";

/** A shop with nothing in it yet — every list the renderer reads, empty. */
const EMPTY_SHOP = {
  rails: {
    featured: [],
    trending: [],
    "best-sellers": [],
    "photo-cakes": [],
    eggless: [],
    seasonal: [],
  },
  categoryRails: {},
  flaggedCategoryRails: {},
  categoryStartingPrices: {},
  categories: [],
  categoryChoices: [],
  catalog: [],
  offers: [],
  testimonials: [],
  faqs: [],
  banners: [],
  instagram: null,
  storeLocation: null,
  trust: {
    freeDeliveryThreshold: 0,
    deliveryPromise: "",
    sameDayCutoff: "",
    sameDayTimeLeft: null,
    rating: null,
  },
};

function draw(
  type: string,
  content: Record<string, string | number | boolean>,
  interactive: boolean,
  background: SectionBackground = "white",
) {
  const section = {
    instanceId: `band-${type}`,
    type,
    order: 0,
    isVisible: true,
    background,
    content,
  } as HomepageSectionInstance;
  return renderToStaticMarkup(
    createElement(HomepageSectionRenderer, { ...EMPTY_SHOP, interactive, section } as never),
  );
}

/** Content with every list emptied, so each band has nothing of its own. */
function emptied(content: Record<string, string | number | boolean>) {
  return Object.fromEntries(
    Object.entries(content).map(([key, value]) =>
      typeof value === "string" && value.trim().startsWith("[") ? [key, "[]"] : [key, value],
    ),
  );
}

describe("an empty band", () => {
  it.each(HOMEPAGE_SECTION_REGISTRY.map((entry) => [entry.type, entry] as const))(
    "%s draws a selectable band in the builder",
    (_type, entry) => {
      const html = draw(entry.type, emptied(entry.defaultContent), true);
      // The element the list scrolls to and the click selects.
      expect(html).toContain(`data-section-id="band-${entry.type}"`);
    },
  );

  it("and the bands that were silent say what they are waiting for", () => {
    const said: Record<string, RegExp> = {
      "our-menu": /has a picture yet/,
      "tabbed-rail": /No tabs yet/,
      "tile-grid": /No tiles yet/,
      "blog-cards": /No posts yet/,
      "banner-grid": /No banners yet/,
      "category-price-cards": /No cards yet/,
      "banner-strip": /No banner with a picture yet/,
      "why-us": /No points yet/,
      testimonials: /No published testimonials/,
    };
    for (const [type, line] of Object.entries(said)) {
      const entry = HOMEPAGE_SECTION_REGISTRY.find((item) => item.type === type);
      expect(entry, `${type} is gone from the registry`).toBeDefined();
      expect(draw(type, emptied(entry!.defaultContent), true), type).toMatch(line);
    }
  });

  it("is still left off the live page", () => {
    for (const type of ["our-menu", "tabbed-rail", "tile-grid", "blog-cards", "banner-grid", "category-price-cards", "banner-strip", "why-us", "testimonials"]) {
      const entry = HOMEPAGE_SECTION_REGISTRY.find((item) => item.type === type)!;
      expect(draw(type, emptied(entry.defaultContent), false), type).toBe("");
    }
  });
});

describe("the Background setting", () => {
  it.each(HOMEPAGE_SECTION_REGISTRY.map((entry) => [entry.type, entry] as const))(
    "%s offers only backgrounds that draw differently",
    (_type, entry) => {
      /*
        The hero is full-bleed, and a card tone on a full-bleed band is
        ignored by design — so five of its seven choices did nothing, and the
        editor offered all seven. `backgrounds` narrows what is offered.
      */
      const offered: SectionBackground[] = entry.backgrounds ?? [
        "white",
        "cream",
        "panel",
        "panel-rose",
        "panel-mint",
        "panel-sand",
        "panel-sky",
      ];
      /*
        The DEFAULT content, not emptied: an empty hero draws its notice in an
        ordinary band, where every tone shows — which made this pass for the
        hero with all seven offered. Its default slides have pictures, so the
        full-bleed band is what gets measured.
      */
      const content = entry.defaultContent;
      const drawn = new Set(offered.map((background) => draw(entry.type, content, true, background)));
      expect(drawn.size, `${entry.type}: ${offered.join(", ")}`).toBe(offered.length);
    },
  );
});
