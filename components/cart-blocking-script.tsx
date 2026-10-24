"use client";

import { useSyncExternalStore } from "react";
import { CART_EMPTY_MARK_SCRIPT } from "@/apps/website/components/storefront-top-bar";

const emptySubscribe = () => () => {};

/** True only during SSR and the matching hydration render. */
function useIsServerRender() {
  return useSyncExternalStore(
    emptySubscribe,
    () => false,
    () => true
  );
}

/**
 * The cart page's "is it empty" mark, before the first paint — the same shape
 * as ThemeBlockingScript, and for the same reason.
 *
 * A bare <script> in the storefront layout ran fine on a full load, but a
 * client-side navigation into that layout (from /account, say) made React
 * create it in the browser, where it never runs, and React said so in the
 * console. Rendered only on the server and the hydration that matches it, it
 * is in the first HTML where it is needed and nowhere else. A client-side
 * arrival does not need it: the cart is read directly then (useCartEmpty).
 */
export function CartBlockingScript() {
  if (!useIsServerRender()) {
    return null;
  }

  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: CART_EMPTY_MARK_SCRIPT }}
    />
  );
}
