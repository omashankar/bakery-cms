/**
 * THE SIZE AN ADMIN IS TOLD TO EXPORT IS THE SHAPE THE STOREFRONT DRAWS.
 *
 * Every picture box on the homepage is a fixed ratio with `object-cover`, so a
 * file exported to the letter of the hint fills its box exactly — and a hint
 * that names a different ratio silently crops what the shop uploaded. The
 * Menu Strip said "600 x 450" over a square tile: a quarter of every picture
 * exported as asked was cut off, and nothing on either screen said so.
 *
 * Pinned pair by pair: each size in a hint against the box class it is drawn
 * in, read from the renderer's own source, so changing a grid without its
 * hint (or the other way round) fails here.
 *
 * And no size above the upload's long-edge cap: files are shrunk to
 * MAX_EDGE before they are stored, so a bigger number is a promise the upload
 * breaks.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { HOMEPAGE_SECTION_REGISTRY } from "@/constants/section-registry";
import { MAX_EDGE } from "@/lib/images/shrink-image";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const RENDERER = read("features/cms-sections/homepage-section-renderer.tsx");
const STRIP = read("features/cms-sections/banner-strip-section.tsx");
const HERO = read("features/cms-sections/hero-carousel.tsx");
const EDITOR = read("apps/admin/builders/shared/section-editor-panel.tsx");

/** "1500 x 580 · 1020 x 600" → [[1500, 580], [1020, 600]], in order. */
const sizesIn = (hint: string) =>
  [...hint.matchAll(/(\d+)\s*x\s*(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);

/** The width ÷ height a box class draws. */
function ratioOf(box: string): number {
  // `size-*` sets width and height together: a square (the why-us circle).
  if (box === "aspect-square" || box.startsWith("size-")) return 1;
  const m = /^aspect-\[(\d+)\/(\d+)\]$/.exec(box);
  if (!m) throw new Error(`not a ratio class: ${box}`);
  return Number(m[1]) / Number(m[2]);
}

function hintOf(section: string, list: string, key: string): string {
  const entry = HOMEPAGE_SECTION_REGISTRY.find((s) => s.type === section);
  const field = entry?.fields.find((f) => f.key === list)?.itemFields?.find((f) => f.key === key);
  expect(field, `${section}.${list}.${key} is gone`).toBeTruthy();
  return field!.hint ?? "";
}

/** Each hint, and the boxes its sizes are drawn in, in the hint's order. */
const CASES: { what: string; hint: () => string; boxes: string[]; source: string }[] = [
  { what: "Menu Strip picture", hint: () => hintOf("our-menu", "picks", "image"), boxes: ["aspect-square"], source: RENDERER },
  { what: "Picture tiles", hint: () => hintOf("tile-grid", "tiles", "image"), boxes: ["aspect-square", "aspect-[4/3]"], source: RENDERER },
  { what: "Blog cards", hint: () => hintOf("blog-cards", "posts", "image"), boxes: ["aspect-[16/9]"], source: RENDERER },
  {
    what: "Banner grid",
    hint: () => hintOf("banner-grid", "banners", "image"),
    boxes: ["aspect-[750/290]", "aspect-[493/290]", "aspect-[11/10]", "aspect-[2/3]"],
    source: RENDERER,
  },
  { what: "Category price cards", hint: () => hintOf("category-price-cards", "items", "image"), boxes: ["aspect-square"], source: RENDERER },
  { what: "Banner strip", hint: () => hintOf("banner-strip", "banners", "image"), boxes: ["aspect-[1520/120]", "aspect-[1520/330]"], source: STRIP },
  {
    what: "Banner strip, phone picture",
    hint: () => hintOf("banner-strip", "banners", "mobileImage"),
    boxes: ["aspect-[760/200]", "aspect-[760/400]"],
    source: STRIP,
  },
  { what: "Why choose us icon", hint: () => hintOf("why-us", "items", "image"), boxes: ["size-[4.25rem]"], source: RENDERER },
  {
    what: "Hero slide",
    hint: () => /label="Slide image"[\s\S]*?hint="([^"]+)"/.exec(EDITOR)?.[1] ?? "",
    boxes: ["aspect-[3/1]"],
    source: HERO,
  },
  {
    what: "Hero phone image",
    hint: () => /label="Phone image \(optional\)"[\s\S]*?hint="([^"]+)"/.exec(EDITOR)?.[1] ?? "",
    boxes: ["aspect-[4/3]"],
    source: HERO,
  },
];

describe("a picture's export size", () => {
  for (const c of CASES) {
    it(`${c.what}: names the shape it is drawn in`, () => {
      const sizes = sizesIn(c.hint());
      expect(sizes.length, `${c.what} names no size`).toBe(c.boxes.length);
      c.boxes.forEach((box, i) => {
        expect(c.source, `${c.what}: the ${box} box is gone from the renderer`).toContain(box);
        const [w, h] = sizes[i];
        const off = Math.abs(w / h / ratioOf(box) - 1);
        expect(off, `${c.what}: ${w} x ${h} is not the ${box} box it fills`).toBeLessThan(0.01);
      });
    });

    it(`${c.what}: is a size the upload keeps`, () => {
      for (const [w, h] of sizesIn(c.hint())) {
        expect(Math.max(w, h), `${c.what}: ${w} x ${h} is shrunk to ${MAX_EDGE} on upload`).toBeLessThanOrEqual(MAX_EDGE);
      }
    });
  }
});
