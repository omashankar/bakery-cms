import { getVisibleNavItems, loadHeaderSettings } from "@/features/site-layout/lib/header-repository";
import { loadFooterSettings } from "@/features/site-layout/lib/footer-repository";

export function getStorefrontHeaderSettings() {
  return loadHeaderSettings();
}

/**
 * Returns the full visible nav (identical on server + client) so hydration never
 * mismatches. Wedding Cakes is bakery-only, but it is hidden VISUALLY via the
 * pre-paint blocking script + CSS (`[data-gate-wedding]`), not by filtering here
 * — filtering on the client (localStorage) would diverge from the server render.
 */
export function getStorefrontNavItems() {
  return getVisibleNavItems();
}

export function getStorefrontFooterSettings() {
  return loadFooterSettings();
}
