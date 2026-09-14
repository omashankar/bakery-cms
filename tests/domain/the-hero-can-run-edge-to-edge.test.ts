import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  heroCopySideOf,
  heroLayoutOf,
  heroSlidesFor,
} from "@/features/cms-sections/lib/section-utils";
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

/**
 * A function's own slice, so an assertion cannot be satisfied by a sibling.
 *
 * The end marker matches an EXPORTED declaration too, and that is the whole
 * point of the regex. With a plain `indexOf("\nfunction ")` the slice for
 * `HeroBannerSlideView` ran past the two exported functions that follow it and
 * returned 8,112 characters — the entire rest of the module — so three
 * assertions below that say "the banner view" were reading HeroCarousel as
 * well. They passed, and they would have gone on passing while the thing they
 * name quietly stopped being true.
 */
function bodyOf(source: string, marker: string, until = /\n(?:export )?(?:function|const) /) {
  source = codeOf(source);
  const at = source.indexOf(marker);
  expect(at, `${marker} is gone from this file`).toBeGreaterThan(-1);
  const rest = source.slice(at + marker.length);
  const next = rest.search(until);
  return marker + (next < 0 ? rest : rest.slice(0, next));
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
    expect(shell, "the slice ran past SectionShell").not.toContain("function HeroSection(");
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
    // Proves the slice stopped where it should: the split view's own sizes
    // string lives above it and the carousel's below, and either one inside
    // this slice would make the next two assertions meaningless.
    expect(view, "the slice ran past the banner view").not.toContain(
      "export function HeroCarousel",
    );
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

  it("reads out what the shop wrote, when the words are part of the picture", () => {
    /**
     * A banner is usually a designed graphic with the headline, the line under
     * it and the button drawn INTO the artwork. None of that reaches the DOM,
     * so a screen reader got the fallback and the shop's actual offer was
     * invisible to the people who most need it read out.
     *
     * The shop's own description has to come FIRST, ahead of both fallbacks —
     * behind either of them it would never be reached on the slides that need
     * it, which are precisely the ones with no headline.
     */
    const view = bodyOf(read(CAROUSEL), "function HeroBannerSlideView(");
    const alt = view.slice(view.indexOf("alt={"), view.indexOf("alt={") + 400);

    expect(alt).toContain("slide.imageAlt");
    expect(
      alt.indexOf("slide.imageAlt"),
      "the shop's description is behind a fallback that always answers first",
    ).toBeLessThan(alt.indexOf("slide.primaryLabel"));

    /*
      AND THE RENDERER HANDS IT OVER. Everything above is about a prop that
      arrives — and the section that builds the slides maps seven fields by
      hand, so leaving this one out of that list is both easy and completely
      silent: the box stays in the builder, the value stays in the document,
      and the picture goes out with the fallback alt.
    */
    const hero = bodyOf(read(RENDERER), "function HeroSection(");
    expect(hero, "the slide mapping drops the description").toContain(
      "imageAlt: slide.imageAlt",
    );
  });

  it("and the split hero prefers it over repeating its own headline", () => {
    const carousel = codeOf(read(CAROUSEL));
    const view = carousel.slice(
      carousel.indexOf("function HeroSlideView("),
      carousel.indexOf("function HeroBannerSlideView("),
    );

    expect(view).toMatch(/alt=\{slide\.imageAlt\?\.trim\(\) \|\| slide\.headline\}/);
  });

  it("has a box to type it in, beside the picture it describes", () => {
    const editor = read("apps/admin/builders/shared/section-editor-panel.tsx");

    expect(editor).toContain("imageAlt: e.target.value");
    // And it says when it matters, rather than asking for it on every slide.
    expect(editor).toContain("Needed when the words are part of the picture");
  });

  it("and a new slide seeds no words nobody wrote", () => {
    /**
     * `headline: "New slide"` publishes as a heading on the live homepage
     * until somebody notices, and `primaryLabel: "Shop Now"` overrides the
     * fallback that would otherwise name whatever this shop actually sells.
     */
    // codeOf, because the note explaining why the two strings went is a
    // verbatim copy of both of them — the third time this file has had to
    // strip its own prose to stop a guard failing on the fix it guards.
    const editor = codeOf(read("apps/admin/builders/shared/section-editor-panel.tsx"));
    const add = editor.slice(editor.indexOf("const addSlide"), editor.indexOf("const removeSlide"));

    expect(add).not.toContain("New slide");
    expect(add).not.toContain("Shop Now");
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

describe("which half of a banner the words sit in", () => {
  it("is the left one for every section stored before the choice existed", () => {
    // Same shape, same risk, same answer as the layout key: `{}` is every
    // hero document in every database, and nothing migrates them.
    expect(heroCopySideOf(content({}))).toBe("left");
  });

  it("is the right one only when the shop asked for it in those exact letters", () => {
    expect(heroCopySideOf(content({ copySide: "right" }))).toBe("right");
    for (const value of ["Right", "RIGHT", "end", "", " right", true, 1]) {
      expect(
        heroCopySideOf(content({ copySide: value })),
        `"${String(value)}" moved the words`,
      ).toBe("left");
    }
  });

  it("is whatever its dropdown offers, and the dropdown leads with the fallback", () => {
    const hero = HOMEPAGE_SECTION_REGISTRY.find((entry) => entry.type === "hero")!;
    const field = hero.fields.find((f) => f.key === "copySide")!;

    expect(field?.options?.[0]?.value, "the editor shows options[0] and commits none").toBe(
      "left",
    );
    expect(hero.defaultContent.copySide).toBe(heroCopySideOf(content({})));
    for (const option of field.options!) {
      expect(
        heroCopySideOf(content({ copySide: option.value })),
        `the dropdown offers "${option.value}" and the renderer does not know it`,
      ).toBe(option.value);
    }
  });

  it("turns the scrim round with the words", () => {
    /**
     * A scrim is a dark wash under the type so white letters stay readable on
     * a photograph nobody here has seen. Left fixed while the words move, it
     * is the worst of both outcomes at once — the subject of the picture
     * dimmed, and the type sitting on the bright half it was meant to protect
     * against. So the direction is not decoration; it is the thing working.
     */
    const view = bodyOf(read(CAROUSEL), "function HeroBannerSlideView(");

    expect(view).toContain("bg-gradient-to-l");
    expect(view).toContain("bg-gradient-to-r");
    expect(view).toMatch(/side === "right"/);
  });
});

describe("the banner band's edges", () => {
  it("cancels the section padding at every breakpoint, not just the base one", () => {
    /**
     * The shell's own padding is `py-16 sm:py-20 lg:py-24` — three classes.
     * tailwind-merge resolves a conflict only within the same breakpoint, so
     * a bare `py-0` cancelled the base and left 80px at sm and 96px at lg: a
     * white gap above a band whose whole purpose is to start where the header
     * ends, at exactly the widths the layout is for.
     */
    const hero = bodyOf(read(RENDERER), "function HeroSection(");
    const branchAt = hero.indexOf('if (layout === "banner")');
    const splitAt = hero.lastIndexOf("  return (");
    const banner = hero.slice(branchAt, splitAt);

    expect(banner).toContain("py-0");
    expect(banner, "sm keeps the shell's 80px").toContain("sm:py-0");
    expect(banner, "lg keeps the shell's 96px").toContain("lg:py-0");
  });

  it("keeps a floor under the dots and the promises", () => {
    // They sit below the picture now rather than over it, so a band padded to
    // zero on both sides leaves them flush against whatever comes next.
    const hero = bodyOf(read(RENDERER), "function HeroSection(");
    const banner = hero.slice(hero.indexOf('if (layout === "banner")'), hero.lastIndexOf("  return ("));

    expect(banner).toMatch(/pb-\d/);
  });

  it("draws no frame down the sides of a band that runs to both edges", () => {
    /**
     * `border-2 border-transparent` is reserved space so the builder's hover
     * and selection outlines do not move the page. Inside a container it is
     * invisible; around a full-bleed band it is 2px of white down each side of
     * the picture, which is the one thing a full-bleed band must not have.
     *
     * Gated on `!interactive`, because a section the builder cannot outline is
     * a section nobody can select.
     */
    const shell = bodyOf(read(RENDERER), "function SectionShell(");

    expect(shell).toMatch(/fullBleed && !interactive && "border-0"/);
    expect(shell, "the builder lost its selection outline").toContain(
      'selected && "border-bakery-500 ring-2 ring-bakery-200"',
    );
  });
});

describe("the slideshow's own controls", () => {
  it("puts the dots below the picture, on the page, in both layouts", () => {
    /**
     * The banner's were absolute over the foot of the image — least legible
     * exactly there (a photograph, not a flat colour) and covering the part of
     * the picture a 3:1 crop has least of. In the flow they land on the page's
     * own background, which is where the split hero already had them, so one
     * row and one palette now serve both.
     */
    const carousel = read(CAROUSEL);
    const at = carousel.indexOf("aria-label={`Go to slide");
    expect(at, "the dots are gone").toBeGreaterThan(-1);

    const row = codeOf(carousel).slice(0, codeOf(carousel).indexOf("aria-label={`Go to slide"));
    const lastRowOpen = row.lastIndexOf("<div");
    const dotsWrapper = row.slice(lastRowOpen);

    expect(dotsWrapper, "the dots are painted over the picture again").not.toContain(
      "absolute",
    );
    expect(dotsWrapper).toContain("justify-center");
  });

  it("gives each dot a target a thumb can hit", () => {
    // 8px is the visual. It is also the only way to change slide on a phone in
    // the split layout, whose arrows are 2xl-only, and 8x8 is below every
    // touch-target floor there is.
    const carousel = codeOf(read(CAROUSEL));
    const dot = carousel.slice(carousel.indexOf("aria-label={`Go to slide"));

    expect(dot.slice(0, 400)).toMatch(/before:-inset-2/);
  });

  it("can be stopped by someone who cannot hover", () => {
    /**
     * Autoplay paused on hover and on focus. A phone has neither — so on the
     * device most of this shop's customers use, a hero that moved every six
     * seconds could not be stopped at all.
     */
    const carousel = codeOf(read(CAROUSEL));

    expect(carousel).toMatch(/setPaused\(\(was\) => !was\)/);
    expect(carousel).toMatch(/aria-label=\{paused \? "Resume slideshow" : "Pause slideshow"\}/);
  });

  it("keeps the banner's arrows off the words on a phone", () => {
    /**
     * At 390px a 44px button centred vertically lands on the headline and
     * takes the first 40px of the line with it — unreadable underneath and
     * untappable through it. Below sm the pair drops to the foot of the
     * picture; the inset position starts at sm, where there is room.
     */
    const carousel = codeOf(read(CAROUSEL));

    /*
      EACH ARROW, not the pair.

      Checking the whole block for one `bottom-3` passed with the left arrow
      moved back onto the headline and the right one left alone, which is
      both a real way to write the bug and the more confusing one to look at.
    */
    for (const which of ["Previous", "Next"]) {
      const at = carousel.indexOf(`aria-label="${which} slide"`);
      expect(at, `the ${which} arrow is gone`).toBeGreaterThan(-1);
      const arrow = carousel.slice(at, at + 700);

      expect(arrow, `the ${which} arrow sits on the words at phone width`).toContain(
        "bottom-3",
      );
      expect(arrow, `the ${which} arrow never takes its inset position`).toMatch(
        /sm:top-1\/2/,
      );
    }
  });
});

describe("a hero with nothing in it", () => {
  it("renders nothing on the live page rather than a band of air", () => {
    /**
     * A banner drops every slide with no picture, and choosing the banner
     * BEFORE uploading wide artwork is the ordinary order of events. With the
     * padding cancelled that empty band is a 4px line across the top of the
     * homepage.
     */
    const hero = bodyOf(read(RENDERER), "function HeroSection(");

    expect(hero).toMatch(
      /slides\.length === 0 && promises\.length === 0 && stats\.length === 0/,
    );
    expect(hero).toContain("if (!props.interactive) return null;");
  });

  it("but says why in the builder, where somebody can fix it", () => {
    // Every other empty section in this file does the same: a section that
    // renders nothing cannot be clicked, and an admin cannot fix what they
    // cannot click.
    const hero = bodyOf(read(RENDERER), "function HeroSection(");

    expect(hero).toContain("border-dashed");
  });
});

describe("the figures a shop typed into the hero", () => {
  it("reach the page in the banner layout too", () => {
    /**
     * The stats strip is painted inside the split hero's copy column. A banner
     * has no copy column — the words are on the picture — so the rows were
     * read, passed to a component that ignores them, and silently dropped: a
     * shop that typed three figures and then chose the banner lost all three,
     * with the boxes still full in the builder.
     */
    const hero = bodyOf(read(RENDERER), "function HeroSection(");

    expect(hero).toContain("const statsStrip =");
    expect(hero).toMatch(/layout !== "banner" \|\| stats\.length === 0 \? null/);

    const banner = hero.slice(
      hero.indexOf('if (layout === "banner")'),
      hero.lastIndexOf("  return ("),
    );
    expect(banner, "the banner band does not render them").toContain("{statsStrip}");
    /*
      AND THE WRAPPER OPENS FOR THEM ON THEIR OWN.

      Asserting the slot alone passed with the condition narrowed back to
      `promisesStrip ?` — the figures then reach the page only when the shop
      also happens to have delivery settings readable, and vanish in the
      builder preview, which has none.
    */
    expect(banner, "the figures render only alongside the promises").toMatch(
      /\{statsStrip \|\| promisesStrip \?/,
    );
  });
});
