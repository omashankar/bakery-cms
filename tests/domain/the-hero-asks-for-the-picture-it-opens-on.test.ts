import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HeroCarousel, type HeroSlide } from "@/features/cms-sections/hero-carousel";

/**
 * THE HERO'S FIRST PICTURE IS THE ONE FETCHED FIRST.
 *
 * The row carries a copy of the last slide before the real ones (so the loop
 * runs forward both ways) and opens on index 1. High fetch priority went to
 * index 0 — the copy of the LAST slide, off screen to the left — so the
 * picture nobody sees was asked for first and the one on screen, the
 * homepage's largest paint, queued behind it. Lighthouse named it: the LCP
 * image had no fetchpriority.
 */
const slide = (name: string): HeroSlide => ({
  headline: name,
  primaryLabel: "Order",
  primaryHref: "/store",
  imageUrl: `https://example.com/${name}.jpg`,
  imageAlt: name,
});

function highPriorityAlts(slides: HeroSlide[]): string[] {
  const html = renderToStaticMarkup(createElement(HeroCarousel, { slides }));
  return [...html.matchAll(/<img\b[^>]*>/g)]
    .map((tag) => tag[0])
    .filter((tag) => /fetchPriority="high"|fetchpriority="high"/i.test(tag))
    .map((tag) => tag.match(/alt="([^"]*)"/)?.[1] ?? "");
}

describe("the hero's first picture", () => {
  it("is the only one asked for at high priority, with several slides", () => {
    const alts = highPriorityAlts([slide("first"), slide("second"), slide("last")]);
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.every((alt) => alt.includes("first")), `high priority went to: ${alts}`).toBe(true);
  });

  it("is still asked for first when the hero has one slide", () => {
    const alts = highPriorityAlts([slide("only")]);
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.every((alt) => alt.includes("only"))).toBe(true);
  });
});
