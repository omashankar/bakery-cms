import { notFound } from "next/navigation";

/**
 * Where the proxy sends a /store URL no page answers (see `lib/store-routes.ts`).
 *
 * It sits OUTSIDE `store/` on purpose: `store/loading.tsx` starts the stream
 * before anything under it can call `notFound()`, which fixes the status at
 * 200. Here nothing suspends first, so this is a real 404 — and it is still
 * inside `(storefront)`, so the shop's header and footer frame it.
 */
export default function StoreNotFoundRoute(): never {
  notFound();
}
