import { describe, expect, it } from "vitest";
import { readSource } from "../renderer-source";

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
const read = (path: string) => readSource(path);

const CARD = "components/storefront/product-card.tsx";
const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";

/** Comments quoting the old code are not the code. */
const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

/** The picture's own block: the box that holds the image, badge and heart. */
function pictureBlock(): string {
  const src = codeOf(read(CARD));
  const at = src.indexOf("relative overflow-hidden rounded-xl bg-cream-100");
  expect(at, "the card's picture box is gone").toBeGreaterThan(-1);
  return src.slice(at, src.indexOf("</div>", at));
}

function priceRow(): string {
  const src = codeOf(read(CARD));
  const at = src.indexOf("<PriceDisplay");
  expect(at, "the price display is gone").toBeGreaterThan(-1);
  return src.slice(at, src.indexOf("</div>", at));
}

describe("the rating on a product card", () => {
  /*
    MOVED BACK TO THE PRICE ROW, on the owner's second marketplace reference
    (2026-10-14): a green pill at the end of the price line, the review count
    under it beside the delivery day. It had sat low-left on the picture on
    an earlier reference.
  */
  it("ends the price row as a green pill", () => {
    const row = priceRow();

    expect(row, "the rating is not in the price row").toContain("{cake.rating ? (");
    expect(row, "the rating is not the green pill").toContain("bg-green-700");
  });

  it("is not also drawn on the picture", () => {
    expect(pictureBlock(), "the rating is on the picture as well").not.toContain("cake.rating");
  });

  it("says how many reviews only when there are some", () => {
    /*
      A rating with no reviews behind it is a number the shop has not earned,
      and "0 Reviews" reads worse than nothing at all.
    */
    const src = codeOf(read(CARD));
    expect(src, "the review count is drawn whether or not there is one").toMatch(
      /\{cake\.rating && cake\.reviewCount \? \([\s\S]{0,260}toLocaleString/,
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
    // The heart is its own client component, so the card can be drawn on the
    // server; it is still only drawn when the row asked for it.
    expect(src, "the heart is drawn whatever the row asked for").toMatch(
      /\{showWishlist \? <ProductCardWishlist /,
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
