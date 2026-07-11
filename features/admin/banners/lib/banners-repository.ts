import type { Banner } from "@/types/media";
import { fixBrokenImageUrl } from "@/constants/demo-images";
import { defaultBanners } from "./banners-utils";

const STORAGE_KEY = "bakery-cms-banners";
const STORAGE_VERSION_KEY = "bakery-cms-banners-version";
const BANNERS_STORAGE_VERSION = 3;

function nowIso(): string {
  return new Date().toISOString();
}

function persist(banners: Banner[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(banners));
}

function normalizeBanner(banner: Banner): Banner {
  return {
    ...banner,
    priority: banner.priority ?? 0,
    visibility: banner.visibility ?? "all",
  };
}

function normalizeBanners(banners: Banner[]): { banners: Banner[]; changed: boolean } {
  let changed = false;
  const next = banners.map((banner) => {
    const image = fixBrokenImageUrl(banner.image);
    const normalized = normalizeBanner({
      ...banner,
      image,
    });
    if (image !== banner.image || JSON.stringify(normalized) !== JSON.stringify(banner)) {
      changed = true;
    }
    return normalized;
  });
  return { banners: next, changed };
}

function isBannerWithinSchedule(banner: Banner, now = Date.now()): boolean {
  if (banner.startDate && new Date(banner.startDate).getTime() > now) return false;
  if (banner.endDate && new Date(banner.endDate).getTime() < now) return false;
  return true;
}

function sortBanners(banners: Banner[]): Banner[] {
  return [...banners].sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title));
}

export function loadBanners(): Banner[] {
  if (typeof window === "undefined") return defaultBanners;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    persist(defaultBanners);
    localStorage.setItem(STORAGE_VERSION_KEY, String(BANNERS_STORAGE_VERSION));
    return defaultBanners;
  }

  try {
    const parsed = JSON.parse(raw) as Banner[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      persist(defaultBanners);
      localStorage.setItem(STORAGE_VERSION_KEY, String(BANNERS_STORAGE_VERSION));
      return defaultBanners;
    }

    const storedVersion = Number(localStorage.getItem(STORAGE_VERSION_KEY) ?? 1);
    const { banners: normalized, changed } = normalizeBanners(parsed);

    if (changed || storedVersion < BANNERS_STORAGE_VERSION) {
      persist(normalized);
      localStorage.setItem(STORAGE_VERSION_KEY, String(BANNERS_STORAGE_VERSION));
    }

    return normalized;
  } catch {
    persist(defaultBanners);
    localStorage.setItem(STORAGE_VERSION_KEY, String(BANNERS_STORAGE_VERSION));
    return defaultBanners;
  }
}

export function saveBanners(banners: Banner[]): Banner[] {
  persist(banners);
  return banners;
}

export function resetBanners(): Banner[] {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
    persist(defaultBanners);
  }
  return defaultBanners;
}

export function getActiveHeroBanners(visibility: Banner["visibility"] | "all" = "all"): Banner[] {
  return sortBanners(
    loadBanners().filter(
      (banner) =>
        banner.isActive &&
        banner.position === "hero" &&
        isBannerWithinSchedule(banner) &&
        (visibility === "all" ||
          banner.visibility === "all" ||
          banner.visibility === visibility)
    )
  );
}

export function getActivePromoBanners(limit = 3, visibility: Banner["visibility"] | "all" = "all"): Banner[] {
  return getActiveHeroBanners(visibility).slice(0, limit);
}

export function createBanner(
  data: Omit<Banner, "id" | "createdAt" | "updatedAt">
): Banner {
  const banners = loadBanners();
  const banner: Banner = {
    ...data,
    id: `banner-${Date.now()}`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  saveBanners([banner, ...banners]);
  return banner;
}

export function updateBanner(id: string, patch: Partial<Banner>): Banner | null {
  const banners = loadBanners();
  const index = banners.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const next = [...banners];
  next[index] = { ...next[index], ...patch, updatedAt: nowIso() };
  saveBanners(next);
  return next[index];
}

export function deleteBanners(ids: string[]): number {
  const banners = loadBanners();
  const next = banners.filter((item) => !ids.includes(item.id));
  saveBanners(next);
  return banners.length - next.length;
}

export function toggleBannerActive(id: string): Banner | null {
  const banner = loadBanners().find((item) => item.id === id);
  if (!banner) return null;
  return updateBanner(id, { isActive: !banner.isActive });
}

export function bulkSetBannerActive(ids: string[], isActive: boolean): number {
  if (ids.length === 0) return 0;
  const idSet = new Set(ids);
  const banners = loadBanners();
  let changed = 0;
  const next = banners.map((banner) => {
    if (!idSet.has(banner.id) || banner.isActive === isActive) return banner;
    changed += 1;
    return { ...banner, isActive, updatedAt: nowIso() };
  });
  if (changed > 0) saveBanners(next);
  return changed;
}
