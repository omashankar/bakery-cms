import type { HeaderNavItem, HeaderSettings } from "@/types/site-layout";
import { defaultHeaderSettings } from "./header-utils";

const STORAGE_KEY = "bakery-cms-header";
const STORAGE_VERSION_KEY = "bakery-cms-header-version";
const HEADER_STORAGE_VERSION = 1;

function nowIso(): string {
  return new Date().toISOString();
}

function persist(settings: HeaderSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function loadHeaderSettings(): HeaderSettings {
  if (typeof window === "undefined") return defaultHeaderSettings;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    persist(defaultHeaderSettings);
    localStorage.setItem(STORAGE_VERSION_KEY, String(HEADER_STORAGE_VERSION));
    return defaultHeaderSettings;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<HeaderSettings>;
    const next = {
      ...defaultHeaderSettings,
      ...parsed,
      nav: parsed.nav?.length ? parsed.nav : defaultHeaderSettings.nav,
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
    const storedVersion = Number(localStorage.getItem(STORAGE_VERSION_KEY) ?? 0);
    if (storedVersion < HEADER_STORAGE_VERSION) {
      localStorage.setItem(STORAGE_VERSION_KEY, String(HEADER_STORAGE_VERSION));
    }
    return next;
  } catch {
    return defaultHeaderSettings;
  }
}

export function saveHeaderSettings(settings: HeaderSettings): HeaderSettings {
  const next = { ...settings, updatedAt: nowIso() };
  persist(next);
  return next;
}

export function resetHeaderSettings(): HeaderSettings {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
    persist(defaultHeaderSettings);
  }
  return defaultHeaderSettings;
}

export function getVisibleNavItems(): HeaderNavItem[] {
  return loadHeaderSettings()
    .nav.filter((item) => item.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
