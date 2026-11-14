import type { LandingProduct } from "@/constants/landing-data";

import { searchCatalog } from "./search-match";

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
  if (query.trim().length < MIN_SUGGEST_CHARS) return [];
  // The same matcher and order as the results page — see search-match.ts.
  return searchCatalog(query, products)
    .hits.slice(0, Math.max(0, limit))
    .map(({ product }) => ({
      slug: product.slug,
      name: product.name,
      category: product.category ?? "",
      image: thumbnailFor(product),
    }));
}
