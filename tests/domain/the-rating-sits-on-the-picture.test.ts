import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * WHERE THE RATING GOES, AND WHO GETS A HEART.
 *
 * The shop pointed at a listing where the rating sits low-left ON the
 * photograph, with the number of reviews beside it, and asked for that. It
 * also asked for the wishlist heart to leave the homepage rows and live on
 * the listing and the product page instead — the two places a customer is
 * comparing rather than passing by.
 *
 * Both are easy to undo by accident, and neither fails loudly: a rating back
 * in the price row still renders, and a heart back on the homepage still
 * works. So they are pinned here.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const CARD = "components/storefront/product-card.tsx";
const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";

/** Comments quoting the old code are not the code. */
const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

/** The picture's own block: the box that holds the image, badge and heart. */
function pictureBlock(): string {
  const src = codeOf(read(CARD));
  const at = src.indexOf("relative overflow-hidden bg-cream-100");
  expect(at, "the card's picture box is gone").toBeGreaterThan(-1);
  const end = src.indexOf("</div>", at);
  return src.slice(at, end);
}

describe("the rating on a product card", () => {
  it("sits on the picture, not in the price row", () => {
    const picture = pictureBlock();

    expect(picture, "the rating is not on the picture").toMatch(/cake\.rating/);
    expect(picture, "the rating is not pinned to the picture's corner").toMatch(
      /absolute bottom-[\d.]+ left-/,
    );
  });

  it("leaves the price line to the price", () => {
    /*
      That line already carries a price, a struck-through price and a
      discount. A fourth thing on it is a scrum — which is the reason the
      rating moved, as much as where the shop wanted it.
    */
    const src = codeOf(read(CARD));
    const at = src.indexOf("<PriceDisplay");
    expect(at, "the price display is gone").toBeGreaterThan(-1);

    const row = src.slice(Math.max(0, at - 200), at + 200);
    expect(row, "the rating is back beside the price").not.toMatch(/cake\.rating/);
  });

  it("says how many reviews only when there are some", () => {
    /*
      A rating with no reviews behind it is a number the shop has not earned,
      and `(0)` beside it reads worse than nothing at all. Guarded because a
      count rendered unconditionally is the obvious way to write this.
    */
    const picture = pictureBlock();

    expect(picture, "the review count is drawn whether or not there is one").toMatch(
      /\{cake\.reviewCount \? \(/,
    );
    // And the aria-label's own ternary is NOT what this is asking about:
    // the first draft matched it and survived the mutation it was written
    // for, because a label saying "from N reviews" is not the count on screen.
    expect(picture, "the count on screen is not guarded").toMatch(
      /\{cake\.reviewCount \? \([\s\S]{0,220}toLocaleString/,
    );
  });
});

describe("the wishlist heart", () => {
  it("is a choice the row makes, and defaults to shown", () => {
    /*
      DEFAULTS TO SHOWN so every surface that had it keeps it — the listing,
      search, the wishlist itself. A default of false would silently strip it
      from all of them.
    */
    const src = codeOf(read(CARD));

    expect(src, "the heart is no longer optional").toContain("showWishlist");
    expect(src, "the heart stopped defaulting to shown").toMatch(
      /showWishlist = true/,
    );
    expect(src, "the heart is drawn whatever the row asked for").toMatch(
      /\{showWishlist \? \(/,
    );
  });

  it("is off in the homepage rows, and nowhere else", () => {
    /*
      The shop asked for it on the listing and the product page, not on the
      rows it scrolls past. Asserted on the CALL SITES, because the prop
      existing proves nothing about who passes it.
    */
    const renderer = codeOf(read(RENDERER));
    const calls = renderer.match(/<ProductCard[^>]*>/g) ?? [];

    expect(calls.length, "the homepage draws no product cards at all").toBeGreaterThan(1);
    for (const call of calls) {
      expect(call, `a homepage row still draws the heart: ${call}`).toContain(
        "showWishlist={false}",
      );
    }
  });
});
