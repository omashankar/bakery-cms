import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HOMEPAGE_SECTION_REGISTRY } from "@/constants/section-registry";
import { HomepageSectionRenderer } from "@/features/cms-sections/homepage-section-renderer";
import type { HomepageSectionInstance } from "@/types/homepage-builder";

/**
 * "Cakes / Dreamy cakes for every occasion" — the owner's reference sets a
 * line under nearly every section title. The header component could always
 * draw one; no section passed it and the builder had no box to type it in.
 */
const LINE = "Dreamy cakes for every occasion";

function render(type: string, content: Record<string, unknown>) {
  const section = {
    instanceId: `${type}-t`,
    type,
    background: "white",
    isVisible: true,
    content: { title: "Cakes", subtitle: LINE, ...content },
  } as unknown as HomepageSectionInstance;
  return renderToStaticMarkup(createElement(HomepageSectionRenderer, { section }))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

const picture = "https://images.unsplash.com/photo-1464349153735-7db50ed83c84?w=600";

describe("the line under a section's title", () => {
  it("is drawn by the sections that take pictures from the builder", () => {
    const tiles = JSON.stringify([{ image: picture, label: "Mugs", href: "/store" }]);
    const banners = JSON.stringify([{ image: picture, label: "Sale", href: "/store" }]);
    const items = JSON.stringify([{ image: picture, title: "Custom designs", description: "Yours" }]);

    expect(render("tile-grid", { tiles })).toContain(LINE);
    expect(render("banner-grid", { banners })).toContain(LINE);
    expect(render("banner-strip", { banners })).toContain(LINE);
    expect(render("why-us", { items })).toContain(LINE);
  });

  it("is not drawn when the shop left it blank", () => {
    const tiles = JSON.stringify([{ image: picture, label: "Mugs", href: "/store" }]);
    expect(render("tile-grid", { tiles, subtitle: "" })).not.toContain(LINE);
  });

  it("has a box in the builder under every section title", () => {
    for (const entry of HOMEPAGE_SECTION_REGISTRY) {
      const keys = entry.fields.map((field) => field.key);
      if (!keys.includes("title")) continue;
      expect(keys, `${entry.type} has a title and no line under it`).toContain("subtitle");
      expect(keys.indexOf("subtitle"), entry.type).toBe(keys.indexOf("title") + 1);
    }
  });
});
