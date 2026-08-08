import type { Banner } from "@/types/media";
import type { WriteResult } from "@/lib/write-result";
import { fixBrokenImageUrl } from "@/constants/demo-images";
import { defaultBanners } from "./banners-utils";
import { replaceBannersRequest } from "./content-api";

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
    // An empty list is an ANSWER, not a missing one.
    //
    // This used to re-seed whenever the stored array was empty, so an admin who
    // deleted every banner saw all three shipped demo banners again on the next
    // reload. Local-only writing does not save it: the admin page reads this list
    // into its state, and every mutation here is a replace-all that sends the
    // whole list — so their next save pushed the demo banners to the server and
    // put them back on the storefront. Only a missing or non-array value seeds.
    if (!Array.isArray(parsed)) {
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

export async function saveBanners(banners: Banner[]): Promise<WriteResult<Banner[]>> {
  persist(banners);
  return { value: banners, persisted: await replaceBannersRequest(banners) };
}

/** Hydration: write the server's banners into the local cache (no re-push). */
export function persistServerBanners(banners: Banner[]): void {
  persist(banners);
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

export async function createBanner(
  data: Omit<Banner, "id" | "createdAt" | "updatedAt">
): Promise<WriteResult<Banner>> {
  const banners = loadBanners();
  const banner: Banner = {
    ...data,
    id: `banner-${Date.now()}`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const { persisted } = await saveBanners([banner, ...banners]);
  return { value: banner, persisted };
}

export async function updateBanner(
  id: string,
  patch: Partial<Banner>
): Promise<WriteResult<Banner | null>> {
  const banners = loadBanners();
  const index = banners.findIndex((item) => item.id === id);
  if (index < 0) return { value: null, persisted: false };
  const next = [...banners];
  next[index] = { ...next[index], ...patch, updatedAt: nowIso() };
  const { persisted } = await saveBanners(next);
  return { value: next[index], persisted };
}

export async function deleteBanners(ids: string[]): Promise<WriteResult<number>> {
  const banners = loadBanners();
  const next = banners.filter((item) => !ids.includes(item.id));
  const { persisted } = await saveBanners(next);
  return { value: banners.length - next.length, persisted };
}

export function toggleBannerActive(id: string): Promise<WriteResult<Banner | null>> {
  const banner = loadBanners().find((item) => item.id === id);
  if (!banner) return Promise.resolve({ value: null, persisted: false });
  return updateBanner(id, { isActive: !banner.isActive });
}

export async function bulkSetBannerActive(
  ids: string[],
  isActive: boolean
): Promise<WriteResult<number>> {
  if (ids.length === 0) return { value: 0, persisted: true };
  const idSet = new Set(ids);
  const banners = loadBanners();
  let changed = 0;
  const next = banners.map((banner) => {
    if (!idSet.has(banner.id) || banner.isActive === isActive) return banner;
    changed += 1;
    return { ...banner, isActive, updatedAt: nowIso() };
  });
  // Nothing changed means nothing was sent, so there is nothing that could have
  // failed to persist.
  if (changed === 0) return { value: 0, persisted: true };
  const { persisted } = await saveBanners(next);
  return { value: changed, persisted };
}
