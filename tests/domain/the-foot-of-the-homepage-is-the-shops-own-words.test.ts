import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HOMEPAGE_SECTION_REGISTRY } from "@/constants/section-registry";

/**
 * THE TWO BANDS AT THE FOOT OF A STOREFRONT HOMEPAGE.
 *
 * The layout this CMS is drawn from closes with a long block of the shop's own
 * writing about its trade, and a row of its own articles. Both were the last
 * section types missing, and both are the kind that are easy to get wrong in
 * the same way: by shipping with something in them.
 *
 * Neither this CMS nor anybody working on it knows what a shop sells, so a
 * seeded paragraph is that shop's words on its own homepage, published by
 * somebody who never wrote them — and a seeded article is worse, because it
 * links somewhere.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";

/** Comments out, so a note explaining a rule cannot satisfy the rule. */
const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("every band a shop can add can actually be drawn", () => {
  it("has a renderer for every type in the registry", () => {
    /**
     * The registry and the switch are two lists that have to agree. A type in
     * one and not the other is a band an admin can add, name, fill in, publish
     * — and then not find on the page, because the switch falls through to
     * `null`. Nothing else in the build says a word about it.
     *
     * Written over the registry rather than over a copy of it, so the next
     * type added fails here until it is wired up.
     */
    const renderer = codeOf(read(RENDERER));

    const missing = HOMEPAGE_SECTION_REGISTRY.map((entry) => entry.type).filter(
      (type) => !renderer.includes(`case "${type}":`),
    );

    expect(missing, `registered with no renderer: ${missing.join(", ")}`).toEqual([]);
  });
});

describe("the block of prose at the foot of the page", () => {
  const entry = HOMEPAGE_SECTION_REGISTRY.find((s) => s.type === "seo-prose");

  it("exists, because every storefront of this kind carries one", () => {
    expect(entry, "the prose band is gone from the registry").toBeTruthy();
  });

  it("ships with nothing written in it", () => {
    /*
      `blocks: "[]"`, not a paragraph about cakes. The shop writes this or it
      does not appear — there is no third answer that is honest.
    */
    expect(entry!.defaultContent.blocks).toBe("[]");
    expect(entry!.defaultContent.title).toBe("");
    expect(entry!.defaultContent.overline).toBe("");
  });

  it("gives the shop a heading and a body for each paragraph", () => {
    const field = entry!.fields.find((f) => f.key === "blocks");
    expect(field?.type).toBe("list");
    expect(field?.itemFields?.map((f) => f.key).sort()).toEqual(["body", "heading"]);
  });

  it("draws nothing at all when nothing is written", () => {
    // Not an empty band with a heading over it: nothing.
    const renderer = codeOf(read(RENDERER));
    const body = renderer.slice(
      renderer.indexOf("function SeoProseSection("),
      renderer.indexOf("function BlogCardsSection("),
    );

    expect(body, "SeoProseSection is gone").not.toBe("");
    expect(body).toContain("if (blocks.length === 0) return null;");
  });

  it("folds the rest away, and shows no control when there is nothing to fold", () => {
    /**
     * Left open this is most of the page's height for the part of it read
     * least. One paragraph stands and the rest is behind a control — and with
     * a single paragraph there is no control, because one that reveals
     * nothing is worse than none.
     */
    const renderer = codeOf(read(RENDERER));
    const body = renderer.slice(
      renderer.indexOf("function SeoProseSection("),
      renderer.indexOf("function BlogCardsSection("),
    );

    expect(body).toContain("blocks.slice(0, 1)");
    expect(body).toContain("blocks.length > 1 ?");
    expect(body, "the toggle does not say whether it is open").toContain("aria-expanded={open}");
    /*
      The shell makes the whole band a select target in the builder, so
      without this an admin pressing the toggle selects the section and never
      sees the text open.
    */
    expect(body, "the toggle lets the builder's select swallow the press").toContain(
      "event.stopPropagation();",
    );
  });
});

describe("the row of the shop's own articles", () => {
  const entry = HOMEPAGE_SECTION_REGISTRY.find((s) => s.type === "blog-cards");

  it("exists", () => {
    expect(entry, "the blog band is gone from the registry").toBeTruthy();
  });

  it("ships with no articles, and invents no link", () => {
    expect(entry!.defaultContent.posts).toBe("[]");
    expect(entry!.defaultContent.ctaHref).toBe("");
    expect(entry!.defaultContent.ctaLabel).toBe("");
  });

  it("draws nothing at all when the shop has written nothing", () => {
    const renderer = codeOf(read(RENDERER));
    const body = renderer.slice(
      renderer.indexOf("function BlogCardsSection("),
      renderer.indexOf("function TileGridSection("),
    );

    expect(body, "BlogCardsSection is gone").not.toBe("");
    expect(body).toContain("if (posts.length === 0) return null;");
  });

  it("puts its link on the heading line, like every other row on the page", () => {
    // A page that puts the same control in two places reads as two pages.
    const renderer = codeOf(read(RENDERER));
    const body = renderer.slice(
      renderer.indexOf("function BlogCardsSection("),
      renderer.indexOf("function TileGridSection("),
    );
    const heading = body.indexOf("<ViewAllLink");
    const grid = body.indexOf("posts.map(");

    expect(heading, "the link is gone from the heading line").toBeGreaterThan(-1);
    expect(heading).toBeLessThan(grid);
  });

  it("draws its cards the way the rest of the page draws cards", () => {
    /*
      One resting shadow and one border weight across the page. A row of
      articles styled on its own is how a homepage ends up looking assembled
      from parts.
    */
    const renderer = codeOf(read(RENDERER));
    const body = renderer.slice(
      renderer.indexOf("function BlogCardsSection("),
      renderer.indexOf("function TileGridSection("),
    );

    expect(body).toContain("shadow-sm");
    expect(body).toContain("border-border/60");

    /*
      AND NOTHING UNDER THE POINTER.

      This asserted `hover:shadow-lg`, then `hover:border-bakery-200`, as the
      card style moved. Both were the wrong thing to pin: the shop asked for
      the design without motion or hover, so what has to hold is that this
      card has NO hover state at all — the same as every other card now.
    */
    expect(body, "the blog card grew a hover state back").not.toMatch(/hover:/);
  });
});
