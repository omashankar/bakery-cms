import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * THE BUY BUTTON, AND THE ROWS THAT DO NOT WANT ONE.
 *
 * A solid full-width button under every one of sixteen cards is the heaviest
 * thing on the homepage, and the rows it sat in are for browsing: the card is
 * already the link, and every choice that makes a cake a cake — weight,
 * flavour, message, photo — is made on the product page anyway.
 *
 * It is OFF on the homepage rows and ON everywhere else, and that default is
 * the part worth guarding. The wishlist is a page whose entire purpose is
 * moving things into the cart; a prop that defaulted to off would empty it
 * silently, on a surface nobody looks at twice.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const CARD = "components/storefront/product-card.tsx";
const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";

const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("who gets a buy button on the card", () => {
  it("everyone, unless they say otherwise", () => {
    /**
     * `showAddToCart = true` in the signature. Fifteen files mount this card —
     * the cart, checkout, the collection and search grids, the wishlist — and
     * not one of them passes the prop, so the default IS the behaviour on
     * every surface but the two that opt out.
     */
    const card = codeOf(read(CARD));

    expect(card, "the prop is gone").toContain("showAddToCart");
    expect(card, "the button no longer defaults to shown").toMatch(
      /showAddToCart = true/,
    );
  });

  it("and the homepage rows say otherwise", () => {
    // Both of them: the product grid every rail uses, and the tabbed rail.
    const renderer = codeOf(read(RENDERER));
    const opted = renderer.match(/<ProductCard[^/]*showAddToCart=\{false\}/g) ?? [];
    const all = renderer.match(/<ProductCard/g) ?? [];

    expect(all.length, "the homepage stopped drawing product cards").toBe(2);
    expect(opted.length, "a homepage row still carries the buy button").toBe(2);
  });

  it("but a card without the button still says when a product is gone", () => {
    /**
     * The button was the only thing on the card carrying "Out of stock".
     * Without it a customer taps through to a product page to find it
     * unavailable — sent there by us, with the card giving no hint.
     */
    const card = codeOf(read(CARD));
    const tail = card.slice(card.indexOf('<div className={cn("mt-auto"'));

    expect(tail, "the price block is gone").not.toBe("");
    expect(tail, "out of stock is stated only on the button again").toMatch(
      /\) : outOfStock \? \(/,
    );
    expect(tail).toContain("Out of stock</p>");
  });

  it("and the price does not keep the gap the button used to fill", () => {
    // `space-y-3` under a lone price is 12px of nothing at the foot of the card.
    const card = codeOf(read(CARD));

    expect(card).toContain('cn("mt-auto", showAddToCart && "space-y-3")');
  });
});
