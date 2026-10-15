"use client";

import { usePathname } from "next/navigation";

import { routes } from "@/constants/routes";

/** The pages where the customer is paying — cart and checkout. */
export function isFocusedCheckoutPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return [routes.store.cart, routes.store.checkout].some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  );
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
  return isFocusedCheckoutPath(usePathname()) ? focused : full;
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
  if (!isFocusedCheckoutPath(usePathname())) return full;
  return (
    <footer className="border-t border-border py-5 text-center text-xs text-muted-foreground">
      © {new Date().getFullYear()} {siteName}. Payments are secured and encrypted.
    </footer>
  );
}
