/**
 * Every page under /store, as a path the proxy can test without the router.
 *
 * WHY THE PROXY HAS TO KNOW. `app/(storefront)/store/loading.tsx` wraps every
 * page under /store in a Suspense boundary, so the response has started
 * streaming — and its status is fixed at 200 — before any page there can call
 * `notFound()`. Next then adds `noindex` and serves the not-found UI under a
 * 200. A real 404 needs the decision made BEFORE rendering starts, which is
 * the proxy (Next's own guidance: node_modules/next/dist/docs, "Status codes"
 * in loading.md).
 *
 * This table answers only "is there a PAGE at this shape of URL". Whether a
 * product or collection slug exists is data, and is left to the page (which
 * answers 200 + noindex for a stale slug; checking slugs here would put a
 * database read in front of every product page).
 *
 * Kept in step with the folders by `tests/domain/store-paths-the-proxy-knows`,
 * which walks `app/(storefront)/store` — a page this table forgot would be
 * served as "not found", so that test is the price of having the table.
 */
const STORE_PAGES: readonly RegExp[] = [
  /^\/store$/,
  /^\/store\/(?:cart|checkout|collections|contact|faq|privacy|terms|thank-you|wishlist)$/,
  /^\/store\/(?:collections|departments|occasions|p|pages|order)\/[^/]+$/,
  /^\/store\/order\/[^/]+\/invoice$/,
];

/** True for a URL that some page under /store renders. */
export function isKnownStorePath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return STORE_PAGES.some((page) => page.test(path));
}

/**
 * Where an unknown /store URL is rewritten to.
 *
 * A route OUTSIDE `store/`, so outside its loading boundary, but inside the
 * `(storefront)` group, so the not-found screen keeps the shop's header,
 * search, cart and footer. The browser's address bar keeps the URL it asked for.
 */
export const STORE_NOT_FOUND_PATH = "/store-not-found";
