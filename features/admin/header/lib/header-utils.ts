import { storefrontNav } from "@/constants/navigation";
import { routes } from "@/constants/routes";
import type { HeaderNavItem, HeaderSettings } from "@/types/site-layout";

function nowIso(): string {
  return new Date().toISOString();
}

export const defaultHeaderSettings: HeaderSettings = {
  logoLetter: "M",
  showSearch: true,
  showCta: true,
  ctaLabel: "Order Inquiry",
  ctaHref: routes.store.contact,
  nav: storefrontNav.map((item, index) => ({
    id: `nav-${index + 1}`,
    label: item.label,
    href: item.href,
    isVisible: true,
    sortOrder: index + 1,
  })),
  updatedAt: nowIso(),
};

export type HeaderOverview = {
  totalLinks: number;
  visibleLinks: number;
  hiddenLinks: number;
  searchEnabled: boolean;
  ctaEnabled: boolean;
};

export function getHeaderOverview(settings: HeaderSettings): HeaderOverview {
  const visibleLinks = settings.nav.filter((item) => item.isVisible).length;
  return {
    totalLinks: settings.nav.length,
    visibleLinks,
    hiddenLinks: settings.nav.length - visibleLinks,
    searchEnabled: settings.showSearch,
    ctaEnabled: settings.showCta,
  };
}

export function reorderHeaderNav(
  nav: HeaderNavItem[],
  id: string,
  direction: "up" | "down"
): HeaderNavItem[] {
  const sorted = [...nav].sort((a, b) => a.sortOrder - b.sortOrder);
  const index = sorted.findIndex((item) => item.id === id);
  if (index < 0) return nav;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= sorted.length) return nav;

  const next = [...sorted];
  [next[index], next[target]] = [next[target], next[index]];
  return next.map((item, order) => ({ ...item, sortOrder: order + 1 }));
}
