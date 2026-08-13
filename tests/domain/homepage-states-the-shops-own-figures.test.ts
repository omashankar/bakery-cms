import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { deliveryPromiseFor } from "@/apps/website/lib/product-details";

/**
 * The homepage may not state a figure the shop already stores differently.
 *
 * Its hero and trust bar asserted three as constants — "4.9 Rating · 2000+
 * reviews", "Same-Day Delivery · Order today, get today", and "Free Delivery ·
 * On orders over ₹999". Every one is a value this CMS holds, so each was a
 * second, stale copy of an answer the shop had already given. On the running
 * shop two were simply wrong: the real rating is 4.7 across 27 approved
 * reviews, and `deliveryLeadDays` is 1 — it cannot deliver same-day at all.
 *
 * The ₹999 matched the current setting, which is worse rather than better: it
 * would have gone on saying ₹999 the moment an admin changed the threshold.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

describe("the delivery promise", () => {
  it("says what the shop's lead time allows", () => {
    expect(deliveryPromiseFor(0)).toBe("Same-day delivery");
    expect(deliveryPromiseFor(1)).toBe("Next-day delivery");
    expect(deliveryPromiseFor(3)).toBe("Delivery from 3 days ahead");
  });

  it("does not promise same-day for a shop that cannot", () => {
    // The running shop is set to 1.
    expect(deliveryPromiseFor(1)).not.toMatch(/same.day/i);
  });

  it("treats a missing or nonsense lead time as same-day rather than throwing", () => {
    // `Number(undefined)` is NaN, and a NaN comparison is false — which would
    // silently fall through to the multi-day branch and render "Delivery from
    // NaN days ahead" on the shop's front page.
    expect(deliveryPromiseFor(Number.NaN)).toBe("Same-day delivery");
    expect(deliveryPromiseFor(-2)).toBe("Same-day delivery");
  });
});

describe("the homepage renderers", () => {
  it("no longer hardcode the figures the shop stores", () => {
    const renderer = stripComments(read("features/cms-sections/homepage-section-renderer.tsx"));
    const carousel = stripComments(read("features/cms-sections/hero-carousel.tsx"));

    for (const claim of ["On orders over ₹999", "Order today, get today", "Since 1956"]) {
      expect(renderer, `the trust bar still states "${claim}"`).not.toContain(claim);
    }
    for (const claim of ["4.9 Rating", "2000+ reviews"]) {
      expect(carousel, `the hero chip still states "${claim}"`).not.toContain(claim);
    }
    expect(renderer, "the why-us card still promises same-day delivery").not.toContain(
      "Order by 2 PM",
    );
  });

  it("renders nothing rather than a demo figure when the shop cannot be read", () => {
    // The admin builder preview mounts these renderers with no server props, so
    // every derived value has to degrade to absent — never to the constant it
    // replaced. That is the whole point: a fallback here would re-assert the
    // invented number on the one surface nobody checks.
    const renderer = read("features/cms-sections/homepage-section-renderer.tsx");

    expect(renderer).toMatch(/trust == null/);
    expect(renderer).toMatch(/props\.trust\?\./);
  });
});

describe("the review aggregate", () => {
  it("counts the whole shop, not one product", () => {
    const repository = read("features/reviews/server/review.repository.ts");
    const start = repository.indexOf("export async function approvedSiteAggregate");
    expect(start, "approvedSiteAggregate is missing").toBeGreaterThan(-1);

    const body = repository.slice(start, start + 700);
    expect(body).toContain('$match: { status: "approved" }');
    // A productSlug in the match would make it the per-product aggregate again.
    expect(body).not.toContain("productSlug");
    // Zero approved is a real answer — the chip disappears rather than inventing.
    expect(body).toContain("{ count: 0, average: 0 }");
  });
});
