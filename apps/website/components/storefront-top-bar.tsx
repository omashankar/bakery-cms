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
