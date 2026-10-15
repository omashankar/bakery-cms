import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HomepageSectionRenderer } from "@/features/cms-sections/homepage-section-renderer";
import type { HomepageSectionInstance } from "@/types/homepage-builder";

/**
 * THE HOMEPAGE STATES THE SHOP'S PROMISES — its rating, its free-delivery
 * threshold and how soon it delivers — from its own data.
 *
 * They were strips inside the hero, taken off at the shop's request and asked
 * for back a month later. They are a band of their own now ("shop-promises"),
 * and every figure in it is read, never written: the rating from approved
 * reviews, the rest from commerce settings.
 */
const trust = {
  freeDeliveryThreshold: 999,
  deliveryPromise: "Same-day delivery",
  sameDayCutoff: "14:00",
  sameDayTimeLeft: null,
  rating: { count: 9, average: 4.56 },
};

function render(content: Record<string, boolean>, trustOverride: Record<string, unknown> = {}) {
  const section = {
    instanceId: "shop-promises-1",
    type: "shop-promises",
    background: "white",
    content,
  } as unknown as HomepageSectionInstance;
  const html = renderToStaticMarkup(
    createElement(HomepageSectionRenderer, { section, trust: { ...trust, ...trustOverride } }),
  );
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("the shop's promises band", () => {
  it("states the rating, the free-delivery threshold and the delivery promise", () => {
    const text = render({ showRating: true, showFreeDelivery: true, showDelivery: true });
    expect(text).toContain("4.6 rating");
    expect(text).toContain("From 9 reviews");
    expect(text).toContain("Free Delivery");
    expect(text).toContain("On orders over ₹999");
    expect(text).toContain("Same-day delivery");
    expect(text).toContain("Order by 14:00");
  });

  it("claims no rating the shop has not earned", () => {
    const text = render({ showRating: true, showFreeDelivery: true, showDelivery: true }, { rating: null });
    expect(text).not.toContain("rating");
    expect(text).toContain("Free Delivery");
  });

  it("shows only what the shop switched on", () => {
    const text = render({ showRating: false, showFreeDelivery: true, showDelivery: false });
    expect(text).not.toContain("4.6");
    expect(text).not.toContain("Same-day");
    expect(text).toContain("Free Delivery");
  });

  it("draws nothing on the page when everything is off", () => {
    expect(render({ showRating: false, showFreeDelivery: false, showDelivery: false }).trim()).toBe("");
  });
});
