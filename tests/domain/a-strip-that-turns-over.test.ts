import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  BANNER_STRIP_MAX,
  HOMEPAGE_SECTION_REGISTRY,
} from "@/constants/section-registry";

/**
 * THE BANNER STRIP.
 *
 * One wide picture at a time, turning over. The words, the offer and the
 * button are drawn INTO the artwork, so the band paints nothing on top of it
 * — and because it moves on its own, it carries the two things anything that
 * moves on its own has to: a way to stop it, and silence for a visitor whose
 * system asks for less movement.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";

const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

function body(): string {
  const src = codeOf(read(RENDERER));
  const at = src.indexOf("function BannerStripSection(");
  expect(at, "BannerStripSection is gone").toBeGreaterThan(-1);
  const rest = src.slice(at + 10);
  const next = rest.search(/\n(?:export )?function /);
  return next < 0 ? src.slice(at) : src.slice(at, at + 10 + next);
}

describe("the strip that turns over", () => {
  const entry = HOMEPAGE_SECTION_REGISTRY.find((s) => s.type === "banner-strip");

  it("is in the registry, and ships with no banners", () => {
    expect(entry, "the banner strip is gone from the registry").toBeTruthy();
    expect(entry!.defaultContent.banners).toBe("[]");
  });

  it("offers no field that would write words over the artwork", () => {
    /*
      The same trap as the banner grid: a title box invites an admin to fill
      it in, and the words land on top of the ones already in the picture.
    */
    const columns = entry!.fields.find((f) => f.key === "banners")?.itemFields ?? [];

    expect(columns.map((c) => c.key).sort()).toEqual(["href", "image", "label"]);
    for (const banned of ["title", "subtitle", "ctaLabel", "description"]) {
      expect(
        entry!.fields.some((f) => f.key === banned),
        `a ${banned} would be drawn over the artwork`,
      ).toBe(false);
    }
  });

  it("takes three banners and no more, in the editor AND on the page", () => {
    /*
      THE EDITOR'S LIMIT IS NOT A GUARANTEE. It stops an admin adding a
      fourth; it does nothing about a fourth already in the document — one
      stored before the cap existed, or written by a script — and the page is
      what the customer sees. So the cap is named once and read twice.
    */
    const field = entry!.fields.find((f) => f.key === "banners");

    expect(field!.maxItems, "the editor will take a fourth banner").toBe(BANNER_STRIP_MAX);
    expect(BANNER_STRIP_MAX).toBe(3);
    expect(body(), "the page draws whatever is stored").toContain(
      ".slice(0, BANNER_STRIP_MAX)",
    );
  });

  it("draws nothing at all when the shop has added no banners", () => {
    expect(body()).toContain("if (count === 0) return null;");
  });

  it("stops turning for a visitor who asked for less movement", () => {
    /*
      Checked in the effect rather than left to CSS: switching the fade off
      would still leave the picture changing underneath it, which is the part
      that moves.
    */
    const section = body();

    expect(section, "the strip turns whatever the visitor asked for").toContain(
      "prefers-reduced-motion: reduce",
    );
  });

  it("stops itself while somebody is reading it", () => {
    /*
      Anything that moves on its own has to be stoppable. The dots WERE the
      control and the shop asked for them off — at 28px tall on a phone they
      took a third of the band — so this is what is left, and it has to keep
      working: a pointer over the strip stops it, and so does tabbing onto
      the banner's own link, which is inside it.

      A strip whose banners carry no link and has no dots turns with nothing
      but the pointer to stop it. That is the cost of removing them, written
      down here rather than discovered later.
    */
    const section = body();

    expect(section, "it turns under a reader's hands").toContain("setPaused(true)");
    expect(section, "it never starts again").toContain("setPaused(false)");
    expect(section, "the pause is ignored by the timer").toContain(
      "if (count < 2 || paused) return;",
    );
  });

  it("turns by flipping, and every waiting banner waits at the same angle", () => {
    /*
      THE SAME ANGLE IS THE WHOLE TRICK. If the outgoing banner rotated one
      way and the incoming one arrived from the other, the two would meet in
      the middle and read as a fold rather than a turn. Resting them all at
      -90 means the one leaving and the one arriving travel the same
      direction, which is how a flip board moves.

      `perspective` is what makes it a flip at all: without it a rotated
      plane is just scaled flat, with no near edge coming toward the reader.
    */
    const section = body();

    expect(section, "the flip has no depth, so it reads as a squash").toContain(
      "perspective",
    );
    expect(section, "the current banner is not face on").toContain(
      "[transform:rotateX(0deg)]",
    );
    expect(section, "a waiting banner is not turned away").toContain(
      "[transform:rotateX(-90deg)]",
    );
    expect(section, "the turn is not animated").toContain("transition-[transform,opacity]");
    expect(section, "the back of a turned banner shows through").toContain(
      "backface-hidden",
    );
    /*
      THE STAGGER IS THE PART THAT MAKES IT A FLIP. Run the leaving banner
      and the arriving one at the same time and they cross through each
      other at 45°, which is a smear rather than a turn. Arriving waits
      exactly as long as leaving takes.

      This was the one thing the other guards did not cover: removing the
      delay left every assertion above green and the animation wrong.
    */
    expect(section, "both halves of the turn run at once").toContain(
      "transitionDelay: i === current ?",
    );
  });

  it("keeps every banner in the page, so a turn shows no gap", () => {
    /*
      A strip that swapped `src` would show the page's background between two
      pictures on every turn, because the next one only starts loading when
      it becomes the current one. They are stacked and turned instead.
    */
    const section = body();

    expect(section, "the banners are no longer stacked").toContain("absolute inset-0 origin-top backface-hidden");
    expect(section, "a hidden banner is still reachable").toContain("pointer-events-none");
  });

  it("hides the banners nobody is looking at from a screen reader", () => {
    // All of them are in the DOM. Without this a reader announces every
    // banner's label at once, and tabbing walks into links nobody can see.
    const section = body();

    expect(section).toContain("aria-hidden={i === current ? undefined : true}");
    expect(section).toContain("tabIndex={i === current ? undefined : -1}");
  });

  it("cannot be left pointing at a banner that was deleted", () => {
    // An admin removes the third of three and the strip is on index 2. The
    // modulo is what stops the band going blank with no clue why.
    expect(body()).toContain("count ? index % count : 0");
  });

  it("states its shape and its pace rather than asking", () => {
    /*
      Both were settings and the shop asked for both boxes gone. They were a
      choice with no good answer behind it: picking a shape in the builder
      does nothing unless the artwork is re-exported to match, and a seconds
      box invites a number — 0.5, 60 — that reads as a strobe or as a banner
      nobody ever sees turn.

      What replaces them is the size, stated on the picture field where the
      shop is standing when it matters.
    */
    for (const gone of ["shape", "seconds"]) {
      expect(
        entry!.fields.some((f) => f.key === gone),
        `${gone} is a box again`,
      ).toBe(false);
      expect(entry!.defaultContent[gone], `${gone} still ships a value`).toBeUndefined();
    }

    const field = entry!.fields.find((f) => f.key === "banners");
    const picture = field!.itemFields!.find((c) => c.isImage);
    expect(picture!.hint, "the picture field does not say what size to export").toMatch(
      /1520/,
    );
  });
});
