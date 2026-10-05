import { ok } from "@/lib/server/http/response";
import { withErrorHandler } from "@/lib/server/http/errors";
import { rateLimit } from "@/lib/server/http/rate-limit";
import { requestContext } from "@/lib/server/audit/audit-log";

import { getStorefrontProductCards } from "@/features/products/data/products-service";
import {
  MIN_SUGGEST_CHARS,
  SUGGESTION_LIMIT,
  suggestProducts,
  type ProductSuggestion,
} from "@/features/products/lib/product-suggestions";

/**
 * WHAT TO SHOW SOMEBODY WHO IS STILL TYPING IN THE HEADER. PUBLIC.
 *
 * It has to be public, because the customer it exists for has not signed in
 * and never will — this shop takes orders from strangers. So the whole design
 * of it is about what a stranger gets back, and the answer is four fields:
 * the name, the picture, the category and the slug. Every one of those is
 * already on the shop's own product pages, visible to anybody who scrolls.
 *
 * WHY NOT SHIP THE CATALOGUE TO THE BROWSER INSTEAD, which would need no
 * endpoint at all: seven storefront routes already hand the full card list to
 * the client, so on those pages a dropdown could filter in memory for free.
 * But the header is on EVERY page — the contact page, the FAQ, the order
 * tracker, the account area — and those do not carry it. Adding it to the
 * chrome so that they would means every one of those pages reads the product
 * collection to draw a box nobody has typed into yet, and the payload grows
 * with the catalogue: the card projection is budgeted for five thousand
 * products, and five thousand of anything is not going into a page header.
 * This asks for six rows and gets six rows.
 *
 * A BLANK QUERY ANSWERS WITH NOTHING, and that is the load-bearing line. The
 * predicate underneath returns the ENTIRE source for an empty string —
 * `searchProducts` does it explicitly — so an endpoint that passed the query
 * straight through would turn `?q=` into "every published product", which is
 * a catalogue dump wearing a search endpoint's name. `suggestProducts` refuses
 * below two characters, and this refuses before calling it, because one of
 * those two is a guard and the other is the reason there is a guard.
 */

/** Longer than any real search, and short enough to bound the work. */
const MAX_QUERY_CHARS = 64;

export const suggestProductsController = withErrorHandler(async (request: Request) => {
  const raw = new URL(request.url).searchParams.get("q") ?? "";
  const query = raw.trim().slice(0, MAX_QUERY_CHARS);

  // Before the read, not after: a stranger holding down a key should not cost
  // a database round trip per keystroke to be told nothing.
  if (query.length < MIN_SUGGEST_CHARS) {
    return ok<ProductSuggestion[]>([], "Nothing to suggest");
  }

  /*
    A LIMIT ON A PUBLIC READ, WHICH THIS API HAS NOWHERE ELSE.

    Every other throttle in this codebase guards a public WRITE. This one
    guards a read, because unlike the other reads it is called per keystroke
    by design, and each call maps the whole published catalogue before
    narrowing it to six rows — there is no index behind this, and React's
    `cache()` on the underlying read is request-scoped, so it absorbs nothing
    between one keystroke and the next.

    Keyed on the IP, and ONLY when there is one. `ctx.ip` is "" unless
    TRUST_PROXY_HEADERS=true, and an empty string is a constant — a bucket
    shared by every visitor at once. The inquiry form learned that the painful
    way: five submissions a minute across the whole shop, so the sixth
    customer on a Saturday got a 429. There is no second key to fall back to
    here (a stranger typing has no email), so with no trusted IP this simply
    does not throttle rather than throttling everyone into one bucket.

    240 a minute is four a second sustained, which no human typing into a
    debounced box reaches and no useful scraper stays under.
  */
  const ctx = requestContext(request);
  if (ctx.ip) rateLimit(`product-suggest:ip:${ctx.ip}`, { limit: 240, windowMs: 60_000 });

  /*
    RANKED ON THE CARD PROJECTION, not on the fuller product, and deliberately.

    The card is what `applyCollectionFilters` matches on, so ranking against
    anything else would let this suggest a product the results page then cannot
    find. `optionLabels` — a sixth of that predicate — exists only on the card.

    An earlier version also read the full products here, to hand the suggestion
    builder each product's whole image array so it could skip an inlined one
    and use the next. That was removed once the images were actually looked at:
    the array is the shop's GALLERY, not sizes of one photograph, so "the next
    one" is a different picture. A product whose first image will not fit gets
    no thumbnail rather than somebody else's.
  */
  const cards = await getStorefrontProductCards();
  return ok(suggestProducts(query, cards, SUGGESTION_LIMIT), "Suggestions");
});
