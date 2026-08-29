/**
 * The Promo Banner section, rendered the way BOTH of its mounts render it.
 *
 * The builder preview header says "Same light sections as live store". It was
 * not. `HomepageSectionRenderer` has two callers and they fed it different
 * lists:
 *
 *   - the storefront (apps/website/pages/store-home-page.tsx) pre-selects on the
 *     server — `selectActiveHeroBanners(raw, "homepage")` — so only live,
 *     homepage-visible hero banners cross the RSC wire, sorted by priority;
 *   - the builder (apps/admin/builders/homepage/homepage-builder-page.tsx)
 *     fetches GET /api/content/banners, which returns the RAW stored array to
 *     staff (content.controller.ts — only anonymous callers get the filtered
 *     view), and passed it straight down.
 *
 * `PromoBannerSection` then only sliced to `maxCount`. So the preview showed
 * switched-off, expired, scheduled, collections-scoped and sidebar banners, in
 * stored order — and `createBanner` prepends, so the newest banner always took
 * tile one whatever its priority or visibility. With maxCount 2, that decides
 * WHICH banners appear: on the fixture below the two surfaces had NOTHING in
 * common, preview ["Diwali Hampers", "Switched Off Sale"] against live
 * ["Wedding Season Special", "Summer Celebration Sale"].
 *
 * This RENDERS both mounts and compares what came out. It deliberately does not
 * read the source or call the selector and assert on its result: this repo has
 * a documented weakness where a structural assertion passes for the very
 * regression it names, and an assertion about `selectActiveHeroBanners` cannot
 * fail while the renderer ignores it. The only input that differs between the
 * two renders is the one thing that differs in production — whether the caller
 * pre-selected — so the test fails unless the renderer selects for itself.
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";

import { HomepageSectionRenderer } from "@/features/cms-sections/homepage-section-renderer";
import { selectActiveHeroBanners } from "@/features/content/lib/banners-utils";
import type { HomepageSectionInstance } from "@/types/homepage-builder";
import type { Banner } from "@/types/media";

function banner(over: Partial<Banner> & { id: string; title: string }): Banner {
  return {
    image: "https://example.com/banner.jpg",
    isActive: true,
    position: "hero",
    priority: 0,
    visibility: "all",
    createdAt: "",
    updatedAt: "",
    ...over,
  } as Banner;
}

const DAY = 86_400_000;
const TOMORROW = new Date(Date.now() + DAY).toISOString();
const YESTERDAY = new Date(Date.now() - DAY).toISOString();

/**
 * What GET /api/content/banners hands the builder: everything the shop has
 * stored, newest first, in every state the Banners screen can produce.
 */
const STORED: Banner[] = [
  banner({ id: "diwali", title: "Diwali Hampers", visibility: "collections" }),
  banner({ id: "off", title: "Switched Off Sale", isActive: false, priority: 50 }),
  banner({ id: "later", title: "Republic Day Preview", startDate: TOMORROW, priority: 50 }),
  banner({ id: "over", title: "Holi Offer", endDate: YESTERDAY, priority: 50 }),
  banner({ id: "side", title: "Free Delivery Strip", position: "sidebar", priority: 99 }),
  banner({ id: "summer", title: "Summer Celebration Sale", priority: 10 }),
  banner({ id: "wedding", title: "Wedding Season Special", visibility: "homepage", priority: 20 }),
];

function promoSection(maxCount: number): HomepageSectionInstance {
  return {
    instanceId: "promo-1",
    type: "promo-banner",
    order: 0,
    isVisible: true,
    background: "cream",
    content: {
      overline: "Limited Time",
      title: "This Week's Offers",
      description: "",
      ctaLabel: "Shop Offers",
      ctaHref: "/store/collections",
      maxCount,
    },
  };
}

/** Mount the section and read back the banner titles it actually painted. */
function renderTitles(section: HomepageSectionInstance, banners: Banner[]): string[] {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(createElement(HomepageSectionRenderer, { section, banners } as never));
  });

  const titles = Array.from(container.querySelectorAll("a p.font-medium")).map(
    (node) => node.textContent ?? ""
  );

  act(() => {
    root.unmount();
  });
  container.remove();
  return titles;
}

/** The builder mount: the raw stored list, exactly as the fetch returns it. */
const asBuilderPreview = (section: HomepageSectionInstance) => renderTitles(section, STORED);

/** The storefront mount: the server's pre-selected snapshot. */
const asStorefront = (section: HomepageSectionInstance) =>
  renderTitles(section, selectActiveHeroBanners(STORED, "homepage"));

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

describe("the Promo Banner section", () => {
  it("paints the same banners in the builder preview as on the live homepage", () => {
    const section = promoSection(2);
    expect(asBuilderPreview(section)).toEqual(asStorefront(section));
  });

  /**
   * The equality above could be satisfied by both sides rendering nothing, so
   * pin what the live answer IS. Priority decides the order — "Wedding Season
   * Special" (20) leads "Summer Celebration Sale" (10) — and nothing that is
   * off, scheduled, expired, sidebar or collections-scoped appears at all.
   */
  it("shows the live homepage banners, priority first", () => {
    expect(asStorefront(promoSection(2))).toEqual([
      "Wedding Season Special",
      "Summer Celebration Sale",
    ]);
  });

  /**
   * maxCount is where the divergence bit: the slice happens AFTER the selection,
   * so with one tile the two surfaces disagreed about which single banner the
   * shop was leading with.
   */
  it.each([1, 2, 3, 5])("agrees at maxCount %i", (maxCount) => {
    const section = promoSection(maxCount);
    expect(asBuilderPreview(section)).toEqual(asStorefront(section));
  });

  /**
   * A shop whose banners are all switched off must look the same on both
   * surfaces too — previously the preview showed all of them.
   */
  it("agrees when nothing is live", () => {
    const section = promoSection(2);
    const allOff = STORED.map((item) => ({ ...item, isActive: false }));
    expect(renderTitles(section, allOff)).toEqual(
      renderTitles(section, selectActiveHeroBanners(allOff, "homepage"))
    );
    expect(renderTitles(section, allOff)).toEqual([]);
  });
});
