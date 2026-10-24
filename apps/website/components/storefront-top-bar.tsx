"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

import { routes } from "@/constants/routes";
import { useCheckoutStep } from "@/apps/website/checkout/lib/checkout-step-store";
import { getCartItemCount, subscribeToCart } from "@/features/cart/lib/cart";

/** The pages where the customer is paying — cart and checkout. */
export function isFocusedCheckoutPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return [routes.store.cart, routes.store.checkout].some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  );
}

/**
 * Marks `<html data-cart-empty>` before the first paint — inlined into the
 * storefront layout, ahead of the header.
 *
 * The cart lives in localStorage, which the server cannot see, so the server
 * sent the cart page with the checkout header and an EMPTY cart swapped to the
 * full one half a second later: a visible flash and a 45px jump, measured.
 * This reads the same key `features/cart` writes and sets the attribute the
 * CSS below `[data-cart-chrome]` keys on, so the first frame is already right.
 * It never throws: storage blocked or unreadable leaves no attribute, and the
 * checkout header shows, as it always did.
 */
export const CART_EMPTY_MARK_SCRIPT = `try{var r=localStorage.getItem("bakery-cms-cart"),a=r?JSON.parse(r):[],n=0;if(Array.isArray(a))for(var i=0;i<a.length;i++)n+=Number(a[i]&&a[i].quantity)||0;document.documentElement.setAttribute("data-cart-empty",n>0?"0":"1")}catch(e){}`;

/**
 * Whether the cart is empty: null while hydrating (the server cannot know, and
 * the first client render must match it), then the cart itself, kept current
 * as lines are added and removed — in this tab or another.
 */
function useCartEmpty(): boolean | null {
  return useSyncExternalStore(
    subscribeToCart,
    () => getCartItemCount() === 0,
    () => null,
  );
}

/**
 * Which chrome this page wears: "focused" (cart and checkout), "full", or
 * "both" — the cart page while the cart is not yet readable, where both are
 * sent and CSS shows the right one from the mark above.
 *
 * AN EMPTY CART WEARS THE FULL ONE. There is nothing to pay for, so it is an
 * ordinary page of the shop, with the shop's whole header and footer to go
 * and find something (the shop's call, 2026-10-24). The cart page's own "I am
 * empty" signal counts too — it can drop lines for products that no longer
 * exist, leaving a cart that is empty on screen though not in storage.
 */
function useChrome(): "focused" | "full" | "both" {
  const pathname = usePathname();
  const step = useCheckoutStep();
  const empty = useCartEmpty();
  if (!isFocusedCheckoutPath(pathname)) return "full";
  if (pathname !== routes.store.cart) return "focused";
  if (step?.hidden || empty === true) return "full";
  return empty === null ? "both" : "focused";
}

/**
 * Chooses the header by page. The layout is a server component and cannot
 * read the path, so both headers are handed in and this picks one.
 */
export function StorefrontTopBar({
  full,
  focused,
}: {
  full: React.ReactNode;
  focused: React.ReactNode;
}) {
  const chrome = useChrome();
  if (chrome !== "both") return chrome === "focused" ? focused : full;
  return (
    <>
      <div data-cart-chrome="focused" className="contents">{focused}</div>
      <div data-cart-chrome="full" className="contents">{full}</div>
    </>
  );
}

/**
 * The footer, except where the customer is paying: the reference ends its cart
 * and checkout without one — no sitemap to wander through, one line of who the
 * shop is.
 */
export function StorefrontFooterSlot({
  full,
  siteName,
}: {
  full: React.ReactNode;
  siteName: string;
}) {
  const chrome = useChrome();
  const slim = (
    <footer className="border-t border-border py-5 text-center text-xs text-muted-foreground">
      © {new Date().getFullYear()} {siteName}. Payments are secured and encrypted.
    </footer>
  );
  if (chrome !== "both") return chrome === "focused" ? slim : full;
  return (
    <>
      <div data-cart-chrome="focused" className="contents">{slim}</div>
      <div data-cart-chrome="full" className="contents">{full}</div>
    </>
  );
}
