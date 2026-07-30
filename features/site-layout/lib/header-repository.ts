import type { HeaderNavItem, HeaderSettings } from "@/types/site-layout";
import { defaultHeaderSettings } from "./header-utils";
import { replaceHeaderRequest } from "./site-layout-api";
import type { WriteResult } from "@/lib/write-result";

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

export async function saveHeaderSettings(
  settings: HeaderSettings
): Promise<WriteResult<HeaderSettings>> {
  const next = { ...settings, updatedAt: nowIso() };
  persist(next);
  return { value: next, persisted: await replaceHeaderRequest(next) };
}

/** Hydration: apply the server's header settings locally (no re-push). */
export function persistServerHeader(settings: HeaderSettings): void {
  persist(settings);
}

export async function resetHeaderSettings(): Promise<WriteResult<HeaderSettings>> {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
    persist(defaultHeaderSettings);
  }
  return { value: defaultHeaderSettings, persisted: await replaceHeaderRequest(defaultHeaderSettings) };
}

export function getVisibleNavItems(): HeaderNavItem[] {
  return loadHeaderSettings()
    .nav.filter((item) => item.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
