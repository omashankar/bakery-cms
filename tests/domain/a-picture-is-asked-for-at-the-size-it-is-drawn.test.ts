/**
 * A PHONE DOWNLOADED MORE PICTURE THAN A DESKTOP DID.
 *
 * Measured on this shop's homepage before the fix:
 *
 *   viewport  390   1,443 KB of images
 *   viewport 1440   1,369 KB of images
 *
 * The phone got MORE, which is the shape of the bug: eight banners in the
 * "Must Have" band were painted at 445x405 and 259x389 and fetched at
 * 800-1100px wide with no `srcset` at all, so every screen got the same large
 * file. They were 1,085 KB of a 1,571 KB page.
 *
 * The cause was `SafeImage`, a native `<img>`. It exists for real reasons —
 * dead-Unsplash repair, a placeholder on error, Mongo documents whose `image`
 * may be anything — and `OptimizedImage` does ALL of that and optimises too:
 * same repair, same trim, same placeholder, same `no-referrer` for a foreign
 * host, and `unoptimized` for any host outside the allow-list so the optimiser
 * cannot throw. The storefront renderer already imported both and already used
 * the optimising one in three places. The split was an oversight.
 *
 * After: 220 KB on a phone, 444 KB on a desktop.
 *
 * WHAT THIS FILE GUARDS IS THE HALF THAT CAN GO WRONG QUIETLY. `fill` with no
 * `sizes` asks for 100vw — so a tile painted at 68px fetches a full-width
 * picture and nothing looks broken. It is the same bug this fixed, written a
 * different way, and no rendering test would catch it.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("every picture the storefront draws", () => {
  const src = code(RENDERER);

  it("goes through the optimiser, not a bare img", () => {
    /*
      `SafeImage` is still right in the ADMIN — a 40px row thumbnail gains
      nothing from the optimiser and the pages behind it are not what a
      customer waits for. This is about the storefront renderer only.
    */
    expect(src, "a storefront band renders a native <img> again").not.toContain("<SafeImage");
    expect(src, "and the import came back with it").not.toContain("safe-image");
    expect(src, "nothing renders a raw img element here").not.toMatch(/<img[\s/>]/);
  });

  it("and asks for it at the size it is drawn", () => {
    /*
      THE HALF THAT FAILS SILENTLY. `fill` with no `sizes` is a 100vw request:
      the picture is correct, the layout is correct, and the page is four
      times heavier than it looks. Counted rather than sampled, because one
      band without it is the whole regression.
    */
    const fills = src.match(/<OptimizedImage\b[\s\S]*?\/>/g) ?? [];
    expect(fills.length, "no OptimizedImage found — the scan is dead").toBeGreaterThan(5);

    const missing = fills
      .filter((tag) => /\bfill\b/.test(tag) && !/\bsizes=/.test(tag))
      .map((tag) => tag.replace(/\s+/g, " ").slice(0, 70));

    expect(missing, "a filled picture asks for the whole viewport").toEqual([]);
  });

  it("and the sizes it asks for are the sizes it paints", () => {
    /*
      THE MEASURED ONES, named so that a later edit to a grid has to come back
      here. Each was read off the rendered page at 390, 768 and 1440 — not off
      the class names, which is how the 68px tile came to be fetching a
      full-size file in the first place.
    */
    const expected: [string, string][] = [
      /*
        THE FIRST TWO ARE NOT WRITTEN `sizes="…"`. The banner grid's two tile
        shapes ask for different pictures, so it is
        `sizes={wide ? "…" : "…"}` — looking for the `sizes=` prefix finds
        neither, which is how the first draft of this case failed.
      */
      ["the banner grid's wide tile", '"(min-width: 1024px) 34vw, 50vw"'],
      ["the banner grid's narrow tile", '"(min-width: 1024px) 20vw, 50vw"'],
      ["the category price cards", 'sizes="(min-width: 1024px) 25vw, 50vw"'],
      [
        "the picture tiles",
        'sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"',
      ],
      [
        "the articles row",
        'sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"',
      ],
      ["why choose us, a 68px tile", 'sizes="72px"'],
    ];

    for (const [what, sizes] of expected) {
      expect(src, `${what} no longer asks for ${sizes}`).toContain(sizes);
    }
  });

  it("and the banner strip, which really is the whole width", () => {
    /*
      NOT AN EXCEPTION TO THE RULE ABOVE — it is a full-bleed band, so 100vw
      is the measurement and not a missing one. Named here so that reading
      `100vw` in this file is never a sign that somebody skipped the work.
    */
    expect(src.match(/sizes="100vw"/g) ?? [], "the strip's two artworks").toHaveLength(2);
  });
});
