import type { FooterSettings } from "@/types/site-layout";
import { defaultFooterSettings } from "./footer-utils";

const STORAGE_KEY = "bakery-cms-footer";
const STORAGE_VERSION_KEY = "bakery-cms-footer-version";
const FOOTER_STORAGE_VERSION = 1;

function nowIso(): string {
  return new Date().toISOString();
}

function persist(settings: FooterSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function loadFooterSettings(): FooterSettings {
  if (typeof window === "undefined") return defaultFooterSettings;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    persist(defaultFooterSettings);
    localStorage.setItem(STORAGE_VERSION_KEY, String(FOOTER_STORAGE_VERSION));
    return defaultFooterSettings;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<FooterSettings>;
    const next = {
      ...defaultFooterSettings,
      ...parsed,
      columns: parsed.columns?.length ? parsed.columns : defaultFooterSettings.columns,
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
    const storedVersion = Number(localStorage.getItem(STORAGE_VERSION_KEY) ?? 0);
    if (storedVersion < FOOTER_STORAGE_VERSION) {
      localStorage.setItem(STORAGE_VERSION_KEY, String(FOOTER_STORAGE_VERSION));
    }
    return next;
  } catch {
    return defaultFooterSettings;
  }
}

export function saveFooterSettings(settings: FooterSettings): FooterSettings {
  const next = { ...settings, updatedAt: nowIso() };
  persist(next);
  return next;
}

export function resetFooterSettings(): FooterSettings {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
    persist(defaultFooterSettings);
  }
  return defaultFooterSettings;
}
