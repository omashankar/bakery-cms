import { getVisibleNavItems, loadHeaderSettings } from "@/features/admin/header";
import { loadFooterSettings } from "@/features/admin/footer";

export function getStorefrontHeaderSettings() {
  return loadHeaderSettings();
}

export function getStorefrontNavItems() {
  return getVisibleNavItems();
}

export function getStorefrontFooterSettings() {
  return loadFooterSettings();
}
