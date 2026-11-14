import { notFound } from "next/navigation";

/**
 * Any /store URL nothing else answers.
 *
 * Without this an unmatched /store path fell through to the ROOT not-found,
 * which renders outside every layout — the shop's colours, but no header,
 * search, cart or footer, so a customer on a stale link had two buttons and no
 * shop. Answering here keeps the 404 inside the storefront layout.
 *
 * It does NOT send a 404 status, whatever this comment once said: under
 * `store/loading.tsx` the stream has started, so Next answers 200 + noindex.
 * The proxy now rewrites unknown /store URLs to `/store-not-found`, which is
 * a real 404 (see `lib/store-routes.ts`); this page is the fallback for the
 * few paths the proxy's matcher skips, such as ones ending in `.png`.
 */
export default function MissingStorePage(): never {
  notFound();
}
