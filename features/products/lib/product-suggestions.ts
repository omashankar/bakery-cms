import type { LandingProduct } from "@/constants/landing-data";

import { searchHaystack } from "./product-catalog";

/**
 * WHAT THE HEADER OFFERS WHILE A CUSTOMER IS STILL TYPING.
 *
 * The box already worked: type, press Enter, land on the results page. What it
 * did not do is answer before the Enter — and on every shop a customer already
 * uses, the answer arrives during the typing. Somebody who types three letters
 * and sees the thing they came for goes straight to it; somebody who sees
 * nothing types two more letters and guesses again.
 *
 * FOUR FIELDS PER ROW AND NOT ONE MORE. A suggestion needs the name to read,
 * the picture to recognise, the category to disambiguate ("Chocolate Truffle
 * in Birthday Cakes" against the same words in Anniversary), and the slug to
 * go to. Everything else on a product card — its price, its variant option
 * groups, the delivery tiers it is scoped to, its internal ids — is either
 * clutter in a dropdown or something a stranger should not be handed by an
 * endpoint that answers without a session.
 *
 * THE RANKING IS THE WHOLE VALUE. A plain substring match over six fields
 * returns "Red Velvet Jar Cake" and "Chocolate Cake (Red rose topper)" in
 * whatever order the catalogue happens to be in, and a dropdown whose first
 * row is the least likely answer is worse than no dropdown, because the
 * customer's eye stops at the top. Products whose NAME starts with what was
 * typed come first, then products a word of whose name starts with it, then
 * the rest of the name, then the category, then everything that matched only
 * through a flavour, an occasion or an option label.
 *
 * WHAT IT WILL NOT DO is suggest something the results page cannot find. Every
 * candidate must pass `searchHaystack` — the same predicate
 * `applyCollectionFilters` runs — before it is ranked at all. The ranking sits
 * ON TOP of that test rather than replacing it, so the set of things this can
 * offer is a subset of the set the page behind Enter will show. A row the
 * customer taps past into a page that then says "no products found" is the
 * shop losing a sale it had already made.
 */

/** One row of the dropdown. Nothing here is worth hiding, which is the point. */
export interface ProductSuggestion {
  slug: string;
  name: string;
  /** The category NAME, already resolved server-side. "" when unfiled. */
  category: string;
  /** A picture to recognise it by. "" when the shop has not given it one. */
  image: string;
}

/**
 * How many rows the dropdown will ever show.
 *
 * A typeahead that drops twenty rows over the page is a second results page
 * with none of a results page's tools — no sort, no filters, no prices, no
 * paging — and it buries the header underneath itself on a laptop. Six is
 * about what fits under the box without covering the first band of the page,
 * and if six is not enough the customer has an Enter key and a page built for
 * exactly that.
 */
export const SUGGESTION_LIMIT = 6;

/**
 * Below this, the dropdown says nothing at all.
 *
 * One letter matches a third of any catalogue, so the rows it returns are
 * noise dressed up as an answer, and the request that fetched them is a
 * request per keystroke for a list nobody can use. Two is where a query
 * starts to mean something.
 */
export const MIN_SUGGEST_CHARS = 2;

/**
 * The product's OWN first picture, or none — never a different one.
 *
 * A product's first image can be an inline `data:` URI. This shop has one:
 * 114,243 characters of base64 sitting where a URL belongs, which would put
 * 114 KB into a response whose other five rows come to about two kilobytes
 * between them. So an inline blob is refused, and the row draws the product's
 * initial instead — a row that reads fine, rather than one that costs fifty
 * times what the rest of the list costs together.
 *
 * WHAT IT MUST NOT DO IS REACH FOR THE NEXT IMAGE, and this function did until
 * the images were actually looked at. The array is not several sizes of one
 * photograph; it is the shop's gallery, and the other entries are DIFFERENT
 * PICTURES. On the very product this was written for, images[1] and images[2]
 * are stock photographs of a woman with shopping bags — so "fall back to the
 * next one" put a stranger in a headscarf under the words "Ring Ceremony
 * Special Cake". A missing thumbnail is a gap; a wrong one is the shop telling
 * a customer that this is what they are buying.
 *
 * The real repair is at the other end — that photograph belongs in the image
 * host like every other, and once it is there this returns it like any other.
 */
function thumbnailFor(product: LandingProduct): string {
  const primary = product.image ?? product.images?.[0] ?? "";
  if (typeof primary !== "string" || primary.trim() === "") return "";
  return primary.startsWith("data:") ? "" : primary;
}

/** Where in a string a word begins, for the "word starts with it" rank. */
function hasWordStartingWith(text: string, query: string): boolean {
  let at = text.indexOf(query);
  while (at !== -1) {
    // Position 0, or anything after a break — so "velvet" ranks on "Red
    // Velvet Cake", and "elvet" does not.
    if (at === 0 || /[\s\-–—(/&,.]/u.test(text[at - 1] ?? "")) return true;
    at = text.indexOf(query, at + 1);
  }
  return false;
}

/**
 * Lower is better. The order is the opinion; the numbers are arbitrary.
 *
 * Returns null for a product that matched nothing at all, which cannot happen
 * for a candidate that passed the haystack test — but this function is also
 * the only thing that decides whether the rank is meaningful, and returning a
 * rank for a non-match would let a caller that forgot the test show anything.
 */
function rankOf(product: LandingProduct, query: string): number | null {
  const name = product.name.toLowerCase();
  const category = (product.category ?? "").toLowerCase();

  if (name.startsWith(query)) return 0;
  if (hasWordStartingWith(name, query)) return 1;
  if (name.includes(query)) return 2;
  if (category.startsWith(query) || hasWordStartingWith(category, query)) return 3;
  if (category.includes(query)) return 4;
  // Matched through a flavour, an occasion or an option label — true, and
  // last, because the customer cannot see why it is here.
  if (searchHaystack(product).includes(query)) return 5;
  return null;
}

/**
 * The rows to offer for what has been typed so far.
 *
 * `products` is REQUIRED and has no default, which is the single most
 * important line in this file. The catalogue helpers in this folder that took
 * an optional one — `searchProducts`, and `getRecentlyViewedProducts` and
 * `reorderFromOrder` before their docblocks were written — fall back to
 * `loadProducts()`, which on a browser with a cold cache seeds the twenty-five
 * SHIPPED DEMO CAKES into the visitor's localStorage and then matches against
 * them. A suggestion dropdown doing that would offer a real shop's customers
 * products it does not sell, at prices it never set, and leave the demo data
 * on their device afterwards. There is no argument to forget here.
 */
export function suggestProducts(
  query: string,
  products: LandingProduct[],
  limit: number = SUGGESTION_LIMIT,
): ProductSuggestion[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < MIN_SUGGEST_CHARS) return [];

  const ranked: { product: LandingProduct; rank: number }[] = [];
  for (const product of products) {
    if (!product?.slug || !product.name) continue;
    const rank = rankOf(product, needle);
    if (rank === null) continue;
    ranked.push({ product, rank });
  }

  /*
    Sorted to a TOTAL order, not just by rank. Two products at rank 1 would
    otherwise come back in catalogue order, which is the order MongoDB happened
    to answer in — so the same three letters could produce a different top row
    on two consecutive keystrokes, and the row under the customer's finger
    would move as they typed. Shorter name first (the closer match to what was
    typed), then alphabetical, which can never tie for two products because the
    slug is unique and the name all but is.
  */
  ranked.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.product.name.length - b.product.name.length ||
      a.product.name.localeCompare(b.product.name) ||
      a.product.slug.localeCompare(b.product.slug),
  );

  return ranked.slice(0, Math.max(0, limit)).map(({ product }) => ({
    slug: product.slug,
    name: product.name,
    category: product.category ?? "",
    image: thumbnailFor(product),
  }));
}
