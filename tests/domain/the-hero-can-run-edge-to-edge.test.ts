import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { heroLayoutOf, heroSlidesFor } from "@/features/cms-sections/lib/section-utils";
import { HOMEPAGE_SECTION_REGISTRY } from "@/constants/section-registry";
import type { HomepageSectionInstance } from "@/types/homepage-builder";

/**
 * THE HERO CAN RUN EDGE TO EDGE — and a shop that never asked still gets the
 * one it has.
 *
 * The reference storefront opens on a full-width banner. This CMS opened on a
 * split hero: a column of words beside a framed photograph, inside the content
 * column. Both are now available, chosen per section, and the whole risk of
 * that change lives in one place — what a section that predates the choice
 * resolves to. Every hero stored before the key existed has no `layout` at all
 * and nothing migrates them, so a wrong fallback silently reshapes the homepage
 * of every shop running this CMS.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";
const CAROUSEL = "features/cms-sections/hero-carousel.tsx";

/**
 * The CODE, with the prose taken out.
 *
 * Every assertion below asks whether the source still says something, and this
 * file's own subject is a set of claims that were REMOVED — so the note in the
 * renderer explaining why each one went is a verbatim copy of the string the
 * test is checking has gone. Scanned raw, these guards fail on the explanation
 * for the very fix they guard. They could also pass for the wrong reason: a
 * claim commented out reads as a claim deleted.
 *
 * Block comments and whole-line `//` comments only, so a `//` inside a string
 * literal survives.
 */
const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

/** A section body's own slice, so an assertion cannot be satisfied by a sibling. */
function bodyOf(source: string, marker: string, until = "\nfunction ") {
  source = codeOf(source);
  const at = source.indexOf(marker);
  expect(at, `${marker} is gone from this file`).toBeGreaterThan(-1);
  const next = source.indexOf(until, at + 1);
  return source.slice(at, next < 0 ? source.length : next);
}

const content = (value: Record<string, unknown>) =>
  value as HomepageSectionInstance["content"];

describe("which hero a section gets", () => {
  it("is the split one for every section stored before the choice existed", () => {
    // The regression this whole file exists for. `{}` is not a hypothetical
    // input: it is the shape of every hero document in every database today,
    // because the key was added in the same change as this test.
    expect(heroLayoutOf(content({}))).toBe("split");
  });

  it("is the banner only when the shop asked for it in those exact letters", () => {
    expect(heroLayoutOf(content({ layout: "banner" }))).toBe("banner");
    expect(heroLayoutOf(content({ layout: "split" }))).toBe("split");
  });

  it("is the split one for anything it does not recognise", () => {
    // A value can reach here from a hand-edited document, an older build's
    // spelling, or a dropdown someone renamed. None of those are a request for
    // a different homepage, so none of them get one.
    for (const value of ["Banner", "BANNER", "full", "full-bleed", "", " banner", true, 1]) {
      expect(heroLayoutOf(content({ layout: value })), `"${String(value)}" changed the hero`).toBe(
        "split",
      );
    }
  });

  it("is whatever the dropdown offers — every option, not just the two named here", () => {
    /**
     * The dropdown and the branch are two lists of strings compared across a
     * Mongo round trip. A third spelling added to one and not the other is a
     * control that appears to work, saves, and changes nothing — the renderer
     * reads a word it does not know and quietly draws the split hero.
     *
     * Written over the registry's own options rather than a copy of them, so
     * adding a third layout to the dropdown fails here until the branch knows
     * it, instead of failing silently on the page.
     */
    const hero = HOMEPAGE_SECTION_REGISTRY.find((entry) => entry.type === "hero");
    const field = hero?.fields.find((f) => f.key === "layout");
    expect(field?.options, "the hero has no layout dropdown").toBeTruthy();

    for (const option of field!.options!) {
      expect(
        heroLayoutOf(content({ layout: option.value })),
        `the dropdown offers "${option.value}" and the renderer does not know it`,
      ).toBe(option.value);
    }
  });
});

describe("the layout dropdown", () => {
  const hero = HOMEPAGE_SECTION_REGISTRY.find((entry) => entry.type === "hero")!;
  const field = hero.fields.find((f) => f.key === "layout")!;

  it("lists split first, because the editor shows the first option and commits none", () => {
    /**
     * `section-editor-panel` renders a select as `value ?? options[0].value` —
     * it DISPLAYS the first option when the key is absent, and never writes it.
     * Every hero stored today has no layout key, so whatever sits first here is
     * what an admin sees. Put the banner first and every shop opens the builder
     * to a control reading "Full-bleed banner" over a preview, and a live page,
     * that are both split.
     */
    expect(field.options?.[0]?.value).toBe("split");
    expect(heroLayoutOf(content({}))).toBe(field.options![0].value);
  });

  it("starts a new hero on the same layout the old ones resolve to", () => {
    // Two defaults, one answer. This one reaches sections created after the
    // deploy; heroLayoutOf's reaches every section created before it. They
    // disagreeing is two shops on one build with two different homepages.
    expect(hero.defaultContent.layout).toBe(heroLayoutOf(content({})));
  });
});

describe("which slides a layout draws", () => {
  const words = { headline: "Order for Diwali", imageUrl: "" };
  const picture = { headline: "", imageUrl: "/b.jpg" };
  const both = { headline: "Gift boxes", imageUrl: "/g.jpg" };
  const neither = { headline: "", imageUrl: "" };

  it("keeps a words-only slide in the split hero", () => {
    // The words are the half a customer reads; the empty frame beside them is
    // already guarded in HeroSlideView.
    expect(heroSlidesFor("split", [words])).toEqual([words]);
  });

  it("drops a words-only slide from the banner", () => {
    /**
     * A banner slide IS its picture — drawn edge to edge with the words laid
     * over it. Without one it is a blank band the height of the hero, and the
     * arrows and dots still count it, so a customer can page onto nothing.
     */
    expect(heroSlidesFor("banner", [words, both])).toEqual([both]);
  });

  it("keeps a picture-only slide in both", () => {
    expect(heroSlidesFor("banner", [picture])).toEqual([picture]);
    expect(heroSlidesFor("split", [picture])).toEqual([picture]);
  });

  it("drops an empty slide from both", () => {
    expect(heroSlidesFor("split", [neither])).toEqual([]);
    expect(heroSlidesFor("banner", [neither])).toEqual([]);
  });

  it("leaves the order the shop put them in", () => {
    const ordered = [both, picture, { headline: "Third", imageUrl: "/3.jpg" }];
    expect(heroSlidesFor("banner", ordered)).toEqual(ordered);
    expect(heroSlidesFor("split", ordered)).toEqual(ordered);
  });
});

describe("the banner band", () => {
  it("leaves the container rather than reaching past it with viewport units", () => {
    /**
     * `100vw` includes the scrollbar, so a viewport-wide child of a page that
     * scrolls is wider than the page and the shop gets a horizontal scrollbar
     * on its own homepage. And the admin builder mounts these renderers inside
     * a 1024px panel, not the viewport, so a viewport-unit bleed is right live
     * and broken in the preview.
     *
     * Dropping the wrapper has neither problem: the section fills its parent,
     * which is the page on the storefront and the panel in the preview.
     */
    const shell = bodyOf(read(RENDERER), "function SectionShell(");
    expect(shell).toContain("fullBleed");
    expect(shell, "the shell reaches out of its parent with viewport units").not.toMatch(
      /w-screen|100vw|50vw\)/,
    );
  });

  it("is the only thing that asks for the full width", () => {
    /**
     * The split hero must NOT carry it — that is the layout every shop is on,
     * and a split hero out of its container is a 2000px line of body text.
     *
     * Sliced at the LAST `return (` rather than at the banner branch: the
     * split return comes after the banner one, so a slice that runs from the
     * branch to the end of the function contains both returns and a stray
     * `fullBleed` on the split one lands inside the half being asserted to
     * have it. That is not hypothetical — the first version of this test read
     * exactly that way and survived the mutation.
     */
    const hero = bodyOf(read(RENDERER), "function HeroSection(");
    const branchAt = hero.indexOf('if (layout === "banner")');
    const splitAt = hero.lastIndexOf("  return (");
    expect(branchAt, "the banner branch is gone").toBeGreaterThan(-1);
    expect(splitAt, "the split return no longer comes last").toBeGreaterThan(branchAt);

    expect(hero.slice(branchAt, splitAt), "the banner no longer runs edge to edge").toContain(
      "fullBleed",
    );
    expect(hero.slice(splitAt), "the split hero broke out of its container").not.toContain(
      "fullBleed",
    );
  });

  it("asks the browser for a source as wide as it is painted", () => {
    /**
     * The split view asks for 45vw on desktop and is right to — it is painted
     * in half a column. Inherited by a band that now spans the window, that
     * picks a source a third of the width it is drawn at and the banner is
     * visibly soft on exactly the screens it was built for.
     */
    const view = bodyOf(read(CAROUSEL), "function HeroBannerSlideView(");
    expect(view).toContain('sizes="100vw"');
    expect(view, "the banner still asks for a split-hero source").not.toContain("45vw");
  });

  it("does not read the headline out twice", () => {
    // The headline is drawn over the picture when there is one, so the picture
    // is decorative and an alt repeating it makes a screen reader say the same
    // sentence again. With no headline the picture is the whole slide.
    const view = bodyOf(read(CAROUSEL), "function HeroBannerSlideView(");
    expect(view).toMatch(/slide\.headline \? "" : slide\.primaryLabel/);
  });
});

describe("what the hero says on the shop's behalf", () => {
  it("no longer pins a freshness claim to every picture", () => {
    /**
     * "100% Fresh" sat in the corner of every hero image, on every slide, for
     * every shop running this CMS, with no box anywhere to edit or remove it —
     * a claim about goods this CMS knows nothing about, made in the shop's
     * name. Scoped to the slide views so the note explaining its removal does
     * not satisfy the test that removed it.
     */
    const source = read(CAROUSEL);
    const views =
      bodyOf(source, "function HeroSlideView(") + bodyOf(source, "function HeroBannerSlideView(");
    expect(views).not.toContain("100% Fresh");
    expect(views).not.toContain("BadgeCheck");
  });

  it("keeps only the two tiles it can actually derive", () => {
    /**
     * The strip was four fixed tiles. Two read the shop's own commerce settings
     * and are facts. Two — "100% Quality / Premium ingredients" and "Made with
     * Love" — were claims with no field behind them.
     *
     * The two that stay are also the ONLY place the homepage states the
     * delivery promise and the free-delivery threshold, which two e2e specs
     * assert appear on /store, so this is not a licence to drop them too.
     */
    const bar = bodyOf(read(RENDERER), "function heroTrustBarFor(");
    expect(bar).not.toContain("100% Quality");
    expect(bar).not.toContain("Made with Love");
    expect(bar).not.toContain("Premium ingredients");
    expect(bar).toContain("freeDeliveryThreshold");
    expect(bar).toContain("deliveryPromise");
  });

  it("says nothing at all when the shop cannot be read", () => {
    // The builder preview mounts the renderer with no server props on every
    // render. A placeholder tile there re-asserts the service on the one
    // surface nobody checks.
    const bar = bodyOf(read(RENDERER), "function heroTrustBarFor(");
    expect(bar).toMatch(/if \(trust == null\) return \[\];/);
  });

  it("gives a shop somewhere to write the promises that were taken away", () => {
    const hero = HOMEPAGE_SECTION_REGISTRY.find((entry) => entry.type === "hero")!;
    const trust = hero.fields.find((f) => f.key === "trust");
    expect(trust?.type, "there is no field for the promises that were removed").toBe("list");
    expect(trust?.itemFields?.map((f) => f.key)).toEqual(["icon", "title", "subtitle"]);
    // Empty is the honest starting state, and the hint has to say what empty
    // means — otherwise it reads as a section somebody forgot to fill in.
    expect(trust?.emptyHint).toBeTruthy();
  });

  it("offers no icon the renderer cannot draw", () => {
    /**
     * The dropdown's values are keys into a map in the renderer. One added to
     * the dropdown and not the map used to put `undefined` in a JSX slot, which
     * throws and takes the homepage with it; it now falls back to a tick, which
     * is silent. Either way the admin picked something and got something else.
     */
    const hero = HOMEPAGE_SECTION_REGISTRY.find((entry) => entry.type === "hero")!;
    const icon = hero.fields
      .find((f) => f.key === "trust")
      ?.itemFields?.find((f) => f.key === "icon");
    expect(icon?.options?.length, "the icon picker lost its options").toBeGreaterThan(0);

    const source = read(RENDERER);
    const map = source.slice(
      source.indexOf("const heroTrustIcons = {"),
      source.indexOf("} as const;", source.indexOf("const heroTrustIcons = {")),
    );
    for (const option of icon!.options!) {
      expect(map, `the icon picker offers "${option.value}" and the renderer has no such icon`)
        .toContain(option.value);
    }
  });
});
