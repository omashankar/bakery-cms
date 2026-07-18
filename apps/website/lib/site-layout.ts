import { getVisibleNavItems, loadHeaderSettings } from "@/features/site-layout/lib/header-repository";
import { loadFooterSettings } from "@/features/site-layout/lib/footer-repository";

export function getStorefrontHeaderSettings() {
  return loadHeaderSettings();
}

export function getStorefrontNavItems() {
  return getVisibleNavItems();
}

export function getStorefrontFooterSettings() {
  return loadFooterSettings();
}
