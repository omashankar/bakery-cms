import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HOMEPAGE_SECTION_REGISTRY } from "@/constants/section-registry";

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

  it("can be stopped, and stops itself while somebody is there", () => {
    // Anything that moves on its own has to be stoppable. The dots are the
    // control; the pause covers a customer reading it or tabbing onto it.
    const section = body();

    expect(section, "there is no way to stop it").toContain("onClick={() => setIndex(i)");
    expect(section, "it turns under a reader's hands").toContain("setPaused(true)");
    expect(section, "it never starts again").toContain("setPaused(false)");
    expect(section, "the pause is ignored by the timer").toContain(
      "if (count < 2 || seconds === 0 || paused) return;",
    );
  });

  it("keeps every banner in the page, so a turn shows no gap", () => {
    /*
      A strip that swapped `src` would show the page's background between two
      pictures on every turn, because the next one only starts loading when
      it becomes the current one. They are stacked and faded instead.
    */
    const section = body();

    expect(section, "the banners are no longer stacked").toContain("absolute inset-0 transition-opacity");
    expect(section, "a hidden banner is still reachable").toContain("pointer-events-none opacity-0");
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

  it("clamps the interval, and keeps 0 as its own answer", () => {
    // 0.2 seconds is a strobe and 600 is a banner nobody sees turn. 0 is not
    // clamped up to 2: it means do not turn at all.
    const section = body();

    expect(section).toContain("typed <= 0 ? 0 :");
    expect(section).toContain("Math.min(30, Math.max(2, typed))");
  });
});
