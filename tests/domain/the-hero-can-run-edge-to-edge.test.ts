import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  heroCopySideOf,
  heroSlidesFor,
} from "@/features/cms-sections/lib/section-utils";
import { HOMEPAGE_SECTION_REGISTRY } from "@/constants/section-registry";
import { headerSchema } from "@/features/site-layout/server/site-layout.validators";
import type { HomepageSectionInstance } from "@/types/homepage-builder";

/**
 * THE HERO RUNS EDGE TO EDGE, and there is no second hero to choose.
 *
 * This CMS used to draw two: a full-width banner, and a column of words
 * beside a framed photograph inside the content column, picked per section
 * from a dropdown. The shop asked for the banner and only the banner, so the
 * choice is gone — one hero, and no control that can get it wrong.
 *
 * What that leaves worth guarding is the shape of the one that remains, and
 * the absence of the one that does not: a stored `layout` key is now an
 * ignored leftover, and nothing may read it back into a branch.
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

describe("there is one hero, and no way to ask for another", () => {
  const hero = HOMEPAGE_SECTION_REGISTRY.find((entry) => entry.type === "hero")!;

  it("offers no layout control, so no shop can pick the one that is gone", () => {
    /**
     * The dropdown read "Split — words beside a picture" / "Full-bleed
     * banner". The shop asked to keep the banner only. A control that still
     * offered the choice would save a value the renderer no longer reads —
     * which looks like a setting that works and does nothing.
     */
    expect(hero.fields.find((f) => f.key === "layout")).toBeUndefined();
    expect(hero.defaultContent.layout, "a new hero is still stamped with a layout").toBeUndefined();
  });

  it("and nothing reads a stored layout back into a branch", () => {
    /**
     * Every hero in every database still carries whatever `layout` it was
     * last saved with — nothing migrates them, and nothing needs to, because
     * an unread key is harmless. It stops being harmless the moment a branch
     * reads it again, so this fails if one does.
     */
    for (const path of [RENDERER, CAROUSEL]) {
      const body = codeOf(read(path));
      expect(body, `${path} branches on a hero layout again`).not.toMatch(
        /layout === "banner"|layout !== "banner"|heroLayoutOf/,
      );
    }
  });
});

describe("a slide list that shrinks under the row", () => {
  /**
   * `index` is state and outlives the `slides` prop. Autoplay walks it to the
   * last slide within seconds, so deleting that slide in the builder used to
   * leave `slides[index]` undefined and `slide.badge` threw — inside the live
   * preview, which has no error boundary, taking every unsaved edit with it.
   * A clamp called `activeSlideIndex` existed to stop it.
   *
   * The clamp is gone because the hero that read a slide by the live index is
   * gone. What remains reads the list at its two ends only, behind a
   * zero-length guard, so there is no index left to outlive anything. That is
   * a stronger guarantee than the clamp was, and this is what pins it: add a
   * read by `index` back and it fails.
   */
  it("is never read at an index, so it cannot be read past its end", () => {
    const body = bodyOf(read(CAROUSEL), "export function HeroCarousel(", /\n(?:export )?function /);

    expect(body, "the carousel draws without a zero-length guard").toContain(
      "if (count === 0) return null;",
    );

    const reads = [...body.matchAll(/slides\[[^\]]*\]/g)].map((m) => m[0]);
    expect(
      [...new Set(reads)].sort(),
      "the carousel reads a slide by something other than the two ends of the list",
    ).toEqual(["slides[0]", "slides[count - 1]"]);
  });
});

describe("which slides the hero draws", () => {
  const words = { headline: "Order for Diwali", imageUrl: "" };
  const picture = { headline: "", imageUrl: "/b.jpg" };
  const both = { headline: "Gift boxes", imageUrl: "/g.jpg" };
  const neither = { headline: "", imageUrl: "" };

  it("drops a words-only slide", () => {
    /**
     * A hero slide IS its picture — drawn edge to edge with the words laid
     * over it. Without one it is a blank band the height of the hero, and the
     * arrows and dots still count it, so a customer can page onto nothing.
     *
     * This was kept when the shop could also choose the split hero, where the
     * words were the half a customer read and the frame beside them was
     * allowed to be empty. There is no such slide now.
     */
    expect(heroSlidesFor([words, both])).toEqual([both]);
    expect(heroSlidesFor([words])).toEqual([]);
  });

  it("keeps a picture-only slide", () => {
    expect(heroSlidesFor([picture])).toEqual([picture]);
  });

  it("drops an empty slide", () => {
    expect(heroSlidesFor([neither])).toEqual([]);
  });

  it("leaves the order the shop put them in", () => {
    const ordered = [both, picture, { headline: "Third", imageUrl: "/3.jpg" }];
    expect(heroSlidesFor(ordered)).toEqual(ordered);
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
     * NO OTHER BAND MAY CARRY IT. A section out of its container is a 2000px
     * line of body text, and every band on this page but the hero is words.
     *
     * This used to slice the hero at its layout branch, because the split
     * return sat after the banner one and a careless slice put the split
     * half inside the half being asserted to have `fullBleed`. There is one
     * return now, so the scoping that matters is which FUNCTION asks.
     */
    const hero = bodyOf(read(RENDERER), "function HeroSection(");
    const shell = bodyOf(read(RENDERER), "function SectionShell(");
    const elsewhere = codeOf(read(RENDERER)).replace(hero, "").replace(shell, "");

    expect(hero, "the hero no longer runs edge to edge").toContain("fullBleed");
    expect(elsewhere, "another band broke out of the container").not.toContain(
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
    // The expression, wherever it is written. It moved out of the JSX into a
    // const once two picture elements had to share it, and an anchor on
    // `alt={` then found `alt={alt}` and read 400 characters of markup.
    const at = view.indexOf("const alt =");
    expect(at, "the banner no longer computes an alt at all").toBeGreaterThan(-1);
    const alt = view.slice(at, at + 400);

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
     * name. Scoped to the slide view so the note explaining its removal does
     * not satisfy the test that removed it.
     */
    const view = bodyOf(read(CAROUSEL), "function HeroBannerSlideView(");
    expect(view).not.toContain("100% Fresh");
    expect(view).not.toContain("BadgeCheck");
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

    expect(hero).toContain("py-0");
    expect(hero, "sm keeps the shell's 80px").toContain("sm:py-0");
    expect(hero, "lg keeps the shell's 96px").toContain("lg:py-0");
  });

  it("keeps a floor under the dots and the promises", () => {
    // They sit below the picture now rather than over it, so a band padded to
    // zero on both sides leaves them flush against whatever comes next.
    const hero = bodyOf(read(RENDERER), "function HeroSection(");

    expect(hero).toMatch(/pb-\d/);
  });

  it("draws no frame down the sides of a band that runs to both edges", () => {
    /**
     * `border-2 border-transparent` is reserved space so the builder's hover
     * and selection outlines do not move the page. Inside a container it is
     * invisible; around a full-bleed band it is 2px of white down each side of
     * the picture, which is the one thing a full-bleed band must not have.
     *
     * THE RULE WIDENED, and this assertion widened with it. It used to read
     * `fullBleed && !interactive`, which dropped the reserve only where it
     * was visible. But it is 4px of height on every band and 4px more white
     * between each pair of them, and nothing on the live storefront can be
     * hovered or selected — so the live page drops it everywhere and only
     * the builder pays for it.
     *
     * Asserted as two halves rather than one string, because what this test
     * is for is the promise, not the spelling: a live full-bleed band has no
     * frame, and the builder can still outline what you click.
     */
    const shell = bodyOf(read(RENDERER), "function SectionShell(");

    expect(shell, "a live band still reserves the builder's 2px").toMatch(
      /(?<!fullBleed && )!interactive && "border-0"/,
    );
    expect(shell, "the builder lost its selection outline").toContain(
      'selected && "border-bakery-500 ring-2 ring-bakery-200"',
    );
    expect(shell, "the reserve is gone from the builder too").toContain(
      "border-2 border-transparent",
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

  it("can be halted by someone who cannot hover", () => {
    /**
     * Autoplay follows `paused`, which follows hover and focus — and a phone
     * has neither, so on the device most of this shop's customers use a hero
     * moving every six seconds could not be held at all.
     *
     * Two things answer that, and neither is a button, because the reference
     * layout's control row is dots and nothing else. `prefers-reduced-motion`
     * switches the autoplay off outright — a setting rather than a control,
     * which reaches the people who most need it without asking them to find
     * anything. And a finger on the picture holds it, through the same touch
     * handlers the swipe uses.
     */
    const carousel = codeOf(read(CAROUSEL));

    expect(carousel).toContain('matchMedia("(prefers-reduced-motion: reduce)")');
    expect(carousel).toMatch(/if \(!multi \|\| paused \|\| nudgedAt\) return;/);
    expect(carousel).toMatch(/\[multi, paused, nudgedAt, count\]/);
  });

  it("and every way of moving between slides pauses it", () => {
    /**
     * `go` is the only thing that sets the pause, so anything that moves a
     * slide WITHOUT going through `go` keeps the carousel running under a
     * customer who has just taken hold of it. The dots used to call
     * `setIndex` directly, and on a phone in the split layout they are the
     * only control there is.
     */
    const carousel = codeOf(read(CAROUSEL));
    const body = carousel.slice(carousel.indexOf("export function HeroCarousel"));

    /*
      TWO HELPERS, and both have to pause. `step` is the arrows and the swipe,
      `goTo` is the dots — and on a phone in the split layout the dots are the
      only control there is, so a dot that moved a slide without pausing would
      leave the autoplay running under a customer who had just taken hold.
    */
    for (const helper of ["step", "goTo"]) {
      const at = body.indexOf(`const ${helper} = useCallback(`);
      expect(at, `${helper} is gone`).toBeGreaterThan(-1);
      expect(body.slice(at, at + 220), `${helper} does not pause the autoplay`).toContain(
        "setNudgedAt(Date.now())",
      );
    }
    expect(body, "the dots move a slide without pausing the autoplay").toContain(
      "onClick={() => goTo(i)}",
    );
    /*
      Six legitimate `setIndex` calls, and no more: the autoplay tick, the
      timed jump off a clone, the step a press queues behind that jump, one in
      each of `step`'s two branches — the ordinary move and the one that comes
      home off a clone first — and `goTo`. Any seventh is a control that moves
      a slide without pausing, which is the fault this counts for.
    */
    expect((body.match(/setIndex\(/g) ?? []).length).toBe(6);
  });

  it("and the row under the picture is dots, with no other control in it", () => {
    // What the reference shows, and what the shop asked for.
    const carousel = codeOf(read(CAROUSEL));

    expect(carousel, "the pause button is back").not.toContain("Pause slideshow");
    expect(carousel, "the pause icons are back").not.toMatch(/[^A-Za-z](Pause|Play)[,\s]/);
  });

  it("keeps the banner's arrows off a band only as tall as its artwork", () => {
    /**
     * An uncropped banner is as tall as its picture is at that width: 130px
     * for 3:1 art on a 390px screen, 81px for 4.8:1. Two 44px buttons and
     * their inset is most of that, over a picture whose words are drawn into
     * it — so below sm they are not drawn at all.
     *
     * Nothing is lost. The dots sit under the picture with a 24px hit area
     * each, which is the visible way to reach slide two that the arrows were
     * being shown at every width to provide.
     */
    const carousel = codeOf(read(CAROUSEL));

    /*
      EACH ARROW, not the pair.

      Checking the whole block for one class passed with the left arrow moved
      back over the picture and the right one left alone, which is both a
      real way to write the bug and the more confusing one to look at.
    */
    for (const which of ["Previous", "Next"]) {
      const at = carousel.indexOf(`aria-label="${which} slide"`);
      expect(at, `the ${which} arrow is gone`).toBeGreaterThan(-1);
      /*
        The button's own class list, cut at its closing `)}` so the slice
        cannot run into the next button and read ITS classes — which is how
        one arrow moved back over the picture with the pair still passing.
      */
      const rest = carousel.slice(at);
      const arrow = rest.slice(0, rest.indexOf(")}"));

      expect(arrow, `the ${which} arrow is drawn over a phone-height band`).toContain(
        "hidden",
      );
      expect(arrow, `the ${which} arrow never appears at all`).toContain("sm:flex");
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
  it("reach the page, rather than a component that ignores them", () => {
    /**
     * The strip used to be painted inside the split hero's copy column. This
     * hero has no copy column — the words are on the picture — so the rows
     * were read, passed to a component that ignored them, and silently
     * dropped: a shop that typed three figures lost all three, with the boxes
     * still full in the builder.
     */
    const hero = bodyOf(read(RENDERER), "function HeroSection(");

    expect(hero).toContain("const statsStrip =");
    expect(hero).toMatch(/stats\.length === 0 \? null/);
    expect(hero, "the band does not render them").toContain("{statsStrip}");
    /*
      AND THE WRAPPER OPENS FOR THEM ON THEIR OWN.

      Asserting the slot alone passed with the condition narrowed back to
      `promisesStrip ?` — the figures then reach the page only when the shop
      also happens to have delivery settings readable, and vanish in the
      builder preview, which has none.
    */
    expect(hero, "the figures render only alongside the promises").toMatch(
      /\{statsStrip \|\| promisesStrip \?/,
    );
  });
});

describe("a wide banner on a phone", () => {
  const bannerView = () => bodyOf(read(CAROUSEL), "function HeroBannerSlideView(");

  it("is not cropped at all when the picture carries the message", () => {
    /**
     * There is no ratio this CMS can pick that is right for every shop's
     * artwork, so it picks none: the band takes its height from the picture
     * and the picture is shown whole.
     *
     * The ladder that used to apply here had a wrong middle rung, and it was
     * wrong for every banner this CMS has ever shipped: `sm:aspect-[2/1]`
     * against 3:1 artwork threw away a third of the width between 640 and
     * 1023px — every tablet, every phone held sideways — and asked for a
     * source 1.5x too small into the bargain. Nothing was wrong at 390px or
     * at 1440px, which is how it survived being looked at.
     */
    const view = bannerView();

    expect(view).toMatch(/const cropped = Boolean\(mobile \|\| slide\.headline\)/);
    expect(view).toMatch(
      /cropped\s*\?\s*"aspect-\[4\/3\] sm:aspect-\[2\/1\] lg:aspect-\[3\/1\]"\s*:\s*"@container"/,
    );
  });

  it("and takes that height from an image that is in the flow", () => {
    /**
     * `absolute inset-0` on the link took the band's only child out of the
     * flow. With no ratio to fall back on the band then had no height source
     * at all and `overflow-hidden` clipped the whole hero to 0px — at every
     * width at once, with every source-scanning guard in this file still
     * green.
     */
    const view = bannerView();

    expect(view).toMatch(/cropped \? "absolute inset-0 block" : "block"/);
  });

  it("reserves the space before the picture loads, without claiming a shape", () => {
    /**
     * `width` and `height` are a pre-load reservation here and nothing else,
     * and both halves of that are checkable rather than believed:
     *
     *  - next/image never reads `width` for the srcset while `sizes` is
     *    present — `getWidths` returns early on `if (sizes)`
     *    (next/dist/shared/lib/get-img-props.js:50-69)
     *  - the attributes compute to `aspect-ratio: auto 1920 / 640`, and the
     *    `auto` keyword hands layout back to the real image's ratio on load
     *
     * So the numbers cannot crop, cannot distort and cannot change which
     * source is served. Dropping them would only make the page jump further.
     */
    const view = bannerView();

    expect(view).toContain("width={1920}");
    expect(view).toContain("height={640}");
    expect(view).toContain("h-auto");
    expect(view, "an uncropped banner is being cropped again").toContain("object-contain");
  });

  it("clamps a pathological upload in container units, never viewport ones", () => {
    /**
     * A portrait photograph dropped into a banner slot would be a 2,500px
     * band. But `vh` resolves against the admin's whole window, and the
     * builder mounts this same component inside a 1024px-max preview panel —
     * so a vh clamp is right live and wrong in the preview, which is the
     * split this file has been bitten by before. `cqw` resolves against the
     * band in both mounts.
     */
    const view = bannerView();

    expect(view).toContain("max-h-[calc(100cqw*0.75)]");
    expect(view, "the clamp is measured against the viewport again").not.toContain("vh]");
  });

  it("and asks for the picture eagerly without the prop Next deprecated", () => {
    // `priority` was deprecated in Next 16; the eager/high pair says the same
    // thing and is what the <picture> branch already hand-rolls.
    const carousel = codeOf(read(CAROUSEL));

    expect(carousel, "priority is back").not.toMatch(/priority=\{priority\}/);
    /*
      THREE, not four. The fourth was the split hero's framed picture, and
      that view is gone — a count left at four would have failed here and
      read as a lost eager hint rather than a deleted component.
    */
    expect((carousel.match(/fetchPriority=\{priority \? "high"/g) ?? []).length).toBe(3);
  });

  it("takes the taller phone box once there is a picture made for it", () => {
    const view = bannerView();
    expect(view).toContain("slide.mobileImageUrl");
    expect(view).toContain('<source media="(min-width: 640px)"');
  });

  it("puts one picture on the wire, not two", () => {
    /**
     * `display: none` does not stop a browser fetching an <img>, so two images
     * toggled with `hidden` / `sm:block` would put both banners on the wire on
     * every device — the largest image on the page, twice, on a phone, before
     * anything else renders. <source media> is the element that picks one.
     */
    const view = bannerView();
    expect(view).toContain("<picture>");
    expect(view, "the phone image is toggled with CSS again").not.toMatch(
      /mobileImageUrl[\s\S]{0,300}sm:hidden/,
    );
  });

  it("and the renderer hands the phone picture over", () => {
    // Seven fields mapped by hand; leaving one out is silent.
    const hero = bodyOf(read(RENDERER), "function HeroSection(");
    expect(hero).toContain("mobileImageUrl: slide.mobileImageUrl");
  });

  it("with a box to upload it that says what it is for", () => {
    const editor = read("apps/admin/builders/shared/section-editor-panel.tsx");
    expect(editor).toContain("mobileImageUrl: next");
    expect(editor).toContain("Used below 640px");
  });
});

describe("what the admin sees of the artwork before it publishes", () => {
  it("the whole of it, in the control used to upload it", () => {
    /**
     * PhotoField defaults to a 16:9 preview and SafeImage bakes `object-cover`
     * into its own class list — so a 4.8:1 banner was cut down to its middle in
     * the very box the admin drops it into. They could not check the artwork
     * the storefront would show, in the screen whose job is to show it.
     *
     * `aspect="wide"` alone does NOT fix it: ASPECT.wide is `aspect-[3/1]`,
     * which still crops anything wider. The fit is the half that matters.
     */
    const editor = read("apps/admin/builders/shared/section-editor-panel.tsx");
    const at = editor.indexOf("id={`slide-${index}-image`}");
    expect(at, "the slide image field is gone").toBeGreaterThan(-1);
    const field = editor.slice(at, at + 400);

    expect(field, "the slide preview crops the banner").toContain('fit="contain"');
    expect(field).toContain('aspect="wide"');
  });

  it("and the phone picture is shown whole too", () => {
    const editor = read("apps/admin/builders/shared/section-editor-panel.tsx");
    const at = editor.indexOf("id={`slide-${index}-mobile-image`}");
    expect(at, "the phone image field is gone").toBeGreaterThan(-1);

    expect(editor.slice(at, at + 400)).toContain('fit="contain"');
  });

  it("because PhotoField actually honours the fit it is given", () => {
    /**
     * SafeImage hardcodes `object-cover` when it fills, so the override only
     * lands because `cn` runs both through tailwind-merge and the later class
     * takes the conflict. A field that accepted the prop and ignored it would
     * pass the two cases above and change nothing on screen.
     */
    const photoField = read("apps/admin/media/components/photo-field.tsx");

    expect(photoField).toMatch(/fit\?: "cover" \| "contain"/);
    expect(photoField).toMatch(/fit === "contain" \? "object-contain" : "object-cover"/);
    // And the default is unchanged, so every other field in the admin keeps
    // the thumbnail crop it was designed around.
    expect(photoField).toMatch(/fit = "cover"/);
  });
});

describe("bands a shop can switch off", () => {
  it("the two delivery facts under the hero, which were not a choice", () => {
    /**
     * They are true — both read from the shop's own commerce settings, and
     * both track them. True is not the same as wanted: a shop carrying its
     * delivery terms in the banner artwork, or not wanting a band of promises
     * under its hero at all, had no way to say so. They appeared because the
     * settings were readable, which is this software deciding for the shop.
     */
    const hero = HOMEPAGE_SECTION_REGISTRY.find((entry) => entry.type === "hero")!;
    const field = hero.fields.find((f) => f.key === "showDeliveryFacts");

    expect(field?.type, "there is no switch for the delivery facts").toBe("boolean");
    // ON by default, so no shop loses a band it already has.
    expect(hero.defaultContent.showDeliveryFacts).toBe(true);
  });

  it("and the renderer defaults it on for a section stored before it existed", () => {
    // Every hero on every shop predates this key. Reading it as false would
    // take the band off all of them at once.
    const body = bodyOf(read(RENDERER), "function HeroSection(");

    expect(body).toMatch(
      /contentBoolean\(section\.content, "showDeliveryFacts", true\)/,
    );
  });

  it("and the promo strip above the header, which drew the same banners twice", () => {
    /**
     * The homepage's Promo Banner section draws the same list, so on the page
     * most customers land on, a shop's offer appeared above the logo AND in
     * the page. The strip also mounts after hydration and pushes everything
     * below it down as it arrives.
     */
    const defaults = read("features/site-layout/lib/header-utils.ts");
    expect(defaults).toContain("showBannerStrip: true");

    const shell = read("layouts/storefront-layout.tsx");
    expect(shell).toMatch(/\{chrome\.showBannerStrip \? <StorefrontBannerStrip \/> : null\}/);
  });

  it("and a stored string cannot turn that switch back on by being truthy", () => {
    /**
     * `headerSchema` is `.passthrough()`, so an undeclared key round-trips
     * unvalidated — and the renderer reads this as `?? true`, so a stored
     * "false" (a string, which is what a hand-edited document or an older
     * form holds) is truthy and the switch stops working in the one direction
     * anybody uses it in.
     */
    const parsed = headerSchema.safeParse({ logoLetter: "", nav: [], showBannerStrip: "false" });
    expect(parsed.success, "a string passed validation as a switch").toBe(false);

    const good = headerSchema.parse({ logoLetter: "", nav: [], showBannerStrip: false }) as {
      showBannerStrip?: boolean;
    };
    expect(good.showBannerStrip).toBe(false);
  });
});

describe("how one slide becomes the next", () => {
  const carousel = () => codeOf(read(CAROUSEL));

  it("the banner draws every slide, because a slide needs somewhere to go", () => {
    /**
     * Mounting one at a time cannot move at any duration: React removes the
     * old node in the same commit that adds the new one, so there is nothing
     * on screen to move and the band hard-cuts between pictures. Every slide
     * is drawn, in a row, and the row is what moves.
     */
    const body = carousel();

    expect(body).toMatch(/\]\.map\(\(slide, i\) => \(/);
    expect(body).toContain("transition-transform");
    expect(body).toContain("w-full shrink-0");
  });

  it("carries a copy of a slide at each end, so no move ever runs backwards", () => {
    /**
     * A wrap used to be a modulo, and a modulo animates the whole row the
     * other way — 2,880px in 700ms on a three-slide hero.
     *
     * ONE clone at the end fixed that for the autoplay and left the arrows
     * doing it, because `go` wrapped separately: pressing Next on the last
     * slide still rewound the lot. Both ends, or neither. The row jumps off a
     * clone with the transition off, which nobody sees because a clone and
     * the slide it copies are the same picture.
     */
    const body = carousel();

    expect(body).toMatch(/\[slides\[count - 1\], \.\.\.slides, slides\[0\]\]\.map/);
    expect(body).toMatch(/snapBack && "transition-none"/);
    // The autoplay only ever counts up; the clones are where the ends go.
    expect(body).toMatch(/setIndex\(\(i\) => \(i >= count \+ 1 \? 2 : i \+ 1\)\)/);
    // And the arrows step, rather than wrapping with an arithmetic of their own.
    expect(body).toContain("onClick={() => step(-1)}");
    expect(body).toContain("onClick={() => step(1)}");
    /*
      Scoped to what `setIndex` is GIVEN, not to the file. `activeIndex` uses
      the same arithmetic to work out which of the shop's slides is showing,
      which is correct and has to stay — a blanket search for it fails on the
      one line that is allowed to do it.
    */
    expect(body, "a control still wraps its own index with a modulo").not.toMatch(
      /setIndex\([^)]*% count/,
    );
  });

  it("and can never be asked for a slide the row does not have", () => {
    /**
     * The jump home takes 740ms, and pressing again inside that window used
     * to step from the clone to the slide AFTER it — which is off the end of
     * the track. Six quick presses reached -13,300px on a five-slide row and
     * the band went blank. Reported by the shop, reproduced in a browser.
     *
     * Three places have to hold the line, because any one of them alone is a
     * blank band: a press that finds the row on a clone brings it home rather
     * than stepping off the end, the autoplay tick cannot run past the end
     * when a background tab coalesces its timer, and the effect that comes
     * home accepts anything out of range rather than only the two clones.
     */
    const body = carousel();

    expect(body, "a step off a clone does not come home first").toMatch(
      /if \(at > 0 && at < count \+ 1\) \{/,
    );
    expect(body, "a step can walk off the end of the track").toMatch(
      /const home = at <= 0 \? count : 1;/,
    );
    expect(body, "the autoplay tick is unbounded").toMatch(
      /setIndex\(\(i\) => \(i >= count \+ 1 \? 2 : i \+ 1\)\)/,
    );
    expect(body, "only the exact clone positions come home").toMatch(
      /if \(index > 0 && index < count \+ 1\) return;/,
    );
  });

  it("and a press at the join waits a frame, so no lap is ever animated back", () => {
    /**
     * Coming home off a clone is a move of a whole lap. Taking that and the
     * next step in one commit hands the browser a single change — the clone
     * at one end to a slide near the other — and it animates that lap, in
     * reverse, across every picture in between. Measured at 1440px: a press
     * at the join ran the row from -5332px to -3487px, two slides backwards,
     * which is how the shop reported it.
     *
     * So the step waits for the jump home to be DRAWN, and one frame is not
     * enough — a callback booked from an effect can run before the browser
     * has painted the commit that booked it, and an undrawn jump home is a
     * jump that never happened.
     */
    const body = carousel();

    expect(body, "the step is taken in the same commit as the jump home").toMatch(
      /pendingStep\.current = direction;/,
    );
    expect(body, "the queued step does not wait for a second frame").toMatch(
      /inner = window\.requestAnimationFrame\(/,
    );
    /*
      A press arriving while the row is already coming home leaves `snapBack`
      set, so `snapBack` on its own as a dependency strands that press's step
      for ever — the arrow stops answering rather than moving the wrong way,
      which is a quieter version of the same fault.
    */
    expect(body, "a step queued during a jump home is never taken").toMatch(
      /\}, \[snapBack, index\]\);/,
    );
  });

  it("and comes off BOTH clones, not just the one at the end", () => {
    // Landing on the head clone and staying there is a hero showing the last
    // slide while the dots say the first, for the rest of the visit.
    const body = carousel();

    expect(body).toMatch(/if \(index > 0 && index < count \+ 1\) return;/);
    expect(body).toMatch(/const landing = index <= 0 \? count : 1;/);
    // And the row starts on the first REAL slide, not on the head clone.
    expect(body).toMatch(/useState\(1\)/);
  });

  it("and every slide is fetched, because an unloaded one stretches the band", () => {
    /**
     * The slides sit in one flex row, so the row is as tall as the tallest —
     * and an image that has not loaded reports the ratio of its `width` and
     * `height` attributes rather than its own. Those are a 3:1 reservation,
     * so a 4.8:1 banner that had not loaded claimed 633px where the loaded
     * ones took 396, and the hero carried 237px of empty band underneath the
     * picture until that slide happened to come round. Measured.
     */
    /*
      THE INTRINSIC PICTURE ONLY, which is the one that can stretch anything.

      The split hero mounts one slide at a time, and the banner's own cropped
      branch sits in a band with a fixed ratio — neither can pull the row
      taller, so neither has to be eager. A search across the file, or even
      across the banner view, finds those legitimate `lazy`s and fails on
      them; the question is only about the `h-auto` one.
    */
    const view = bodyOf(read(CAROUSEL), "function HeroBannerSlideView(");
    const at = view.indexOf("h-auto");
    expect(at, "the intrinsic banner picture is gone").toBeGreaterThan(-1);
    // Its OWN element, found by walking back to the tag that opens it — a
    // fixed-size window reaches into the cropped branch above, whose `lazy` is
    // legitimate because its band has a ratio and cannot be stretched.
    const opens = view.lastIndexOf("<OptimizedImage", at);
    expect(opens, "the intrinsic picture is not an OptimizedImage").toBeGreaterThan(-1);
    const intrinsic = view.slice(opens, at);

    expect(intrinsic, "the picture that sizes the row is still lazy").not.toContain(
      '"lazy"',
    );
    expect(intrinsic).toContain('loading="eager"');
    // `priority` still decides which one is asked for FIRST.
    expect(intrinsic).toMatch(/fetchPriority=\{priority \? "high" : undefined\}/);
  });

  it("and the track follows the row, not the slide number", () => {
    /**
     * `activeIndex` is `index % count`, so at the clone it reads 0 — and a
     * transform built from it never moves onto the clone at all: the row
     * jumped home instead of sliding there, which looked exactly like the
     * rewind this was meant to remove. Measured; the first version shipped it.
     */
    const body = carousel();

    expect(body).toMatch(/translateX\(-\$\{index \* 100\}%\)/);
    expect(body, "the track is driven by the slide number again").not.toContain(
      "translateX(-${activeIndex * 100}%)",
    );
  });

  it("and a press pauses the autoplay rather than ending it", () => {
    /**
     * It used to be sticky: one press of an arrow and the hero never moved
     * again for the rest of the visit. That was meant as the pause control,
     * and it reads as a carousel that has died — which is how it was
     * reported. What answers the requirement instead is `prefers-reduced-
     * motion`, which switches the autoplay off entirely, plus hover and focus
     * holding it while they last.
     */
    const body = carousel();

    expect(body).toMatch(/setNudgedAt\(Date\.now\(\)\)/);
    expect(body).toMatch(/setTimeout\(\(\) => setNudgedAt\(0\), RESUME_MS\)/);
    expect(body, "the pause is permanent again").not.toContain("const [stopped, setStopped]");
  });

  it("and a mouse click does not leave it paused", () => {
    /**
     * A click leaves the button it landed on focused, and `onFocusCapture`
     * took that as somebody reading — so pressing Next once paused the
     * autoplay until the visitor clicked somewhere else entirely. Measured:
     * the hero had not moved fifteen seconds later.
     *
     * `:focus-visible` is exactly the distinction: set for focus arrived at
     * by keyboard, not for focus left behind by a pointer.
     */
    const body = carousel();

    expect(body).toContain('matches(":focus-visible")');
    expect(body, "focus pauses it however it arrived").not.toMatch(
      /onFocusCapture=\{\(\) => setPaused\(true\)\}/,
    );
  });

  it("and the timings the loop depends on are named, not scattered", () => {
    // `SLIDE_MS` has to match the track's own duration or the jump home
    // happens mid-move and the rewind is visible after all.
    const body = carousel();

    expect(body).toContain("const SLIDE_MS = 700;");
    expect(body).toContain("duration-700");
    expect(body).toMatch(/const RESUME_MS = \d+;/);
  });

  it("and moves the row by exactly one slide, not by one third of one", () => {
    /**
     * `translateX` resolves its percentage against the element's OWN width,
     * and the track is NOT as wide as its contents: its width comes from its
     * parent, each child is `w-full` of that, and `shrink-0` lets the row
     * overflow rather than growing it. So the track measures one slide and
     * 100% of it is one slide.
     *
     * `100 / count` is the version that reads correct and is not. It assumes a
     * track as wide as all the slides together, and on a three-slide hero it
     * moved 480px of a 1440px slide — measured in a browser, which is the only
     * place the question can be settled, and the first version of this shipped
     * it.
     */
    const body = carousel();

    expect(body, "the track is being moved a fraction of a slide").not.toContain(
      "(index * 100) / count",
    );
  });

  it("and clips the slides that are off the side of it", () => {
    // Without this the row simply extends past the window and gives the whole
    // storefront a horizontal scrollbar as wide as every slide together.
    const body = carousel();
    const at = body.indexOf("slides.map((slide, i) => (");

    expect(body.slice(0, at)).toContain('<div className="overflow-hidden"');
  });

  it("and the ones off screen are out of the tab order", () => {
    /**
     * A banner slide IS a link. `aria-hidden` alone hides it from a screen
     * reader and leaves it tabbable, so a keyboard user would tab through the
     * pictures that are off the side of the screen before reaching the page.
     * `inert` does both.
     *
     * Against `index`, not `activeIndex`: while the row sits on the clone
     * those two differ, and it is the clone that is on screen.
     */
    expect(carousel()).toMatch(/inert=\{i !== index\}/);
  });

  it("and a 700ms move is not forced on somebody who asked for less", () => {
    expect(carousel()).toContain("motion-reduce:transition-none");
  });

  it("and there is no second view left to mount one slide at a time", () => {
    /**
     * The split hero mounted one slide per commit, because its copy arrived
     * on a staggered entrance and an animation only plays on mount. That is
     * the arrangement that cannot slide — React removes the old node in the
     * same commit that adds the new one — so if it ever comes back beside
     * this one, the hero has two answers again and one of them hard-cuts.
     */
    const body = carousel();

    expect(body, "a second slide view is back").not.toContain("HeroSlideView");
    expect(body, "a slide is mounted on its own again").not.toMatch(
      /key=\{activeIndex\}/,
    );
  });
});

describe("the column the page is drawn in", () => {
  it("is one width, and the header uses it too", () => {
    /**
     * The header drew `max-w-7xl` inline while the bands below it took theirs
     * from `layoutSpacing` — so widening the content column would have left
     * the logo, the search box and the nav band lining up with nothing.
     */
    const spacing = read("constants/spacing.ts");
    const navbar = codeOf(read("apps/website/components/storefront-navbar.tsx"));

    expect(spacing).toContain('container: "mx-auto w-full max-w-[1440px]');
    expect(navbar, "the header still fixes its own width").not.toContain("max-w-7xl");
    // The three rows of the header: utility, main bar, category band.
    expect((navbar.match(/layoutSpacing\.container/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("and the wide one is still wider than it", () => {
    // `containerWide` was 1400, which the line above has just overtaken. A
    // ladder whose top rung is below the one under it is not a ladder.
    const spacing = read("constants/spacing.ts");
    const width = (key: string) =>
      Number(new RegExp(`${key}: "mx-auto w-full max-w-\\[(\\d+)px\\]`).exec(spacing)?.[1] ?? 0);

    expect(width("containerWide")).toBeGreaterThan(width("container"));
  });
});
