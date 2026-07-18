import { specialOffers } from "@/constants/landing-data";
import { demoPhotoIds, unsplash } from "@/constants/demo-images";
import type { Banner } from "@/types/media";
import { routes } from "@/constants/routes";

function nowIso(): string {
  return new Date().toISOString();
}

export const defaultBanners: Banner[] = [
  {
    id: "banner-hero-1",
    title: "Summer Celebration Sale",
    image: specialOffers[0]?.image ?? unsplash(demoPhotoIds.chocolateCake, 1200, 630),
    link: routes.store.collections,
    isActive: true,
    position: "hero",
    priority: 10,
    visibility: "all",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: "banner-hero-2",
    title: "Wedding Season Special",
    image: specialOffers[1]?.image ?? unsplash(demoPhotoIds.pastries, 1200, 630),
    link: routes.store.weddingCakes,
    isActive: true,
    position: "hero",
    priority: 10,
    visibility: "all",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: "banner-sidebar-1",
    title: "Free delivery on orders above ₹999",
    image: unsplash(demoPhotoIds.cookies, 800, 600),
    link: routes.store.contact,
    isActive: false,
    position: "sidebar",
    priority: 5,
    visibility: "collections",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

export const bannerVisibilityOptions = [
  { value: "all", label: "All storefront pages" },
  { value: "homepage", label: "Homepage only" },
  { value: "collections", label: "Collections pages" },
] as const;

export const bannerPositionOptions = [
  { value: "hero", label: "Hero strip (top of storefront)" },
  { value: "sidebar", label: "Sidebar promo" },
  { value: "popup", label: "Popup (future)" },
] as const;

export type BannerListFilters = {
  search: string;
  status: "all" | "active" | "inactive" | "scheduled" | "expired";
  position: "all" | Banner["position"];
  visibility: "all" | "storewide" | Banner["visibility"];
  sort: "priority" | "newest" | "title";
};

export const defaultBannerFilters: BannerListFilters = {
  search: "",
  status: "all",
  position: "all",
  visibility: "all",
  sort: "priority",
};

export type BannerOverview = {
  total: number;
  active: number;
  hero: number;
  inactive: number;
  scheduled: number;
  expired: number;
};

export type BannerScheduleState = "live" | "scheduled" | "expired" | "inactive";

export function getBannerScheduleState(
  banner: Banner,
  now = Date.now()
): BannerScheduleState {
  if (!banner.isActive) return "inactive";
  if (banner.startDate && new Date(banner.startDate).getTime() > now) return "scheduled";
  if (banner.endDate && new Date(banner.endDate).getTime() < now) return "expired";
  return "live";
}

export function getBannerOverview(banners: Banner[]): BannerOverview {
  let active = 0;
  let hero = 0;
  let inactive = 0;
  let scheduled = 0;
  let expired = 0;

  for (const banner of banners) {
    const state = getBannerScheduleState(banner);
    if (state === "live") {
      active += 1;
      if (banner.position === "hero") hero += 1;
    } else if (state === "inactive") {
      inactive += 1;
    } else if (state === "scheduled") {
      scheduled += 1;
    } else {
      expired += 1;
    }
  }

  return {
    total: banners.length,
    active,
    hero,
    inactive,
    scheduled,
    expired,
  };
}

export function formatBannerPosition(position: Banner["position"]): string {
  switch (position) {
    case "hero":
      return "Hero";
    case "sidebar":
      return "Sidebar";
    case "popup":
      return "Popup";
    default:
      return position;
  }
}

export function formatBannerVisibility(visibility: Banner["visibility"]): string {
  switch (visibility) {
    case "all":
      return "All pages";
    case "homepage":
      return "Homepage";
    case "collections":
      return "Collections";
    default:
      return visibility;
  }
}

export function formatBannerScheduleState(state: BannerScheduleState): string {
  switch (state) {
    case "live":
      return "Active";
    case "scheduled":
      return "Scheduled";
    case "expired":
      return "Expired";
    case "inactive":
      return "Inactive";
    default:
      return state;
  }
}

export function getBannerStatusVariant(
  state: BannerScheduleState
): "success" | "secondary" | "warning" | "outline" {
  switch (state) {
    case "live":
      return "success";
    case "scheduled":
      return "warning";
    case "expired":
      return "outline";
    default:
      return "secondary";
  }
}

export function filterBanners(
  banners: Banner[],
  filters: BannerListFilters
): Banner[] {
  const query = filters.search.trim().toLowerCase();

  let next = banners.filter((banner) => {
    if (query) {
      const haystack = `${banner.title} ${banner.link ?? ""} ${banner.image}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    if (filters.position !== "all" && banner.position !== filters.position) return false;

    if (filters.visibility === "storewide") {
      if (banner.visibility !== "all") return false;
    } else if (filters.visibility !== "all" && banner.visibility !== filters.visibility) {
      return false;
    }

    if (filters.status !== "all") {
      const state = getBannerScheduleState(banner);
      if (filters.status === "active" && state !== "live") return false;
      if (filters.status === "inactive" && state !== "inactive") return false;
      if (filters.status === "scheduled" && state !== "scheduled") return false;
      if (filters.status === "expired" && state !== "expired") return false;
    }

    return true;
  });

  next = [...next].sort((a, b) => {
    if (filters.sort === "title") return a.title.localeCompare(b.title);
    if (filters.sort === "newest") {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
    return b.priority - a.priority || a.title.localeCompare(b.title);
  });

  return next;
}
