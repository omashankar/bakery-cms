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
      // `undefined` is an absence; `[]` is the shop saying there are none.
      // Treating both as absent meant a shop that deleted every row got the
      // DEMO set back in the editor — and the next save published it. The
      // server already keeps an empty list (`cms-store` seeds only an absent
      // collection), so the two disagreed about the same shop.
      nav: parsed.nav ?? defaultHeaderSettings.nav,
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

/**
 * Local write first, then the server — and the local write is UNDONE when
 * the server refuses.
 *
 * Without this a rejected save still sat in localStorage, and nothing put it
 * right: `ensureSiteLayoutHydrated` short-circuits once the gate has settled,
 * so the poisoned cache survived the session. A remount then adopted it as
 * BOTH the working copy and the saved one, so the screen presented a value
 * the server had rejected as saved, with Save greyed out and no way to retry.
 *
 * The rollback restores ONLY if this write is still the one in the cache —
 * restoring unconditionally would undo a concurrent save the server had
 * accepted in between, a rejected write destroying a good one. The appearance
 * store carries the same guard for the same reason.
 */
async function persistAndSync(next: HeaderSettings): Promise<boolean> {
  const previous = typeof window === "undefined" ? null : localStorage.getItem(STORAGE_KEY);

  persist(next);
  const accepted = await replaceHeaderRequest(next);

  if (!accepted && typeof window !== "undefined") {
    const stillOurs = localStorage.getItem(STORAGE_KEY) === JSON.stringify(next);
    if (stillOurs) {
      if (previous === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, previous);
    }
  }

  return accepted;
}

export async function saveHeaderSettings(
  settings: HeaderSettings
): Promise<WriteResult<HeaderSettings>> {
  const next = { ...settings, updatedAt: nowIso() };
  return { value: next, persisted: await persistAndSync(next) };
}

/** Hydration: apply the server's header settings locally (no re-push). */
export function persistServerHeader(settings: HeaderSettings): void {
  persist(settings);
}

/**
 * Reset goes through the same path, and that matters most here.
 *
 * This wiped the cache to the demo defaults BEFORE asking the server, and
 * then returned those defaults whether or not the server took them. Since
 * `runWrite` commits the returned value as the working copy regardless, a
 * refused reset left the editor showing the demo seed with the shop's real
 * nav gone from that browser — and the next accepted save published the demo
 * seed to the database. The most destructive action on the screen was the one
 * with no way back.
 */
export async function resetHeaderSettings(): Promise<WriteResult<HeaderSettings>> {
  const persisted = await persistAndSync(defaultHeaderSettings);

  // On refusal, hand back what is ACTUALLY in place — the rollback has just
  // restored it — rather than what was attempted.
  return { value: persisted ? defaultHeaderSettings : loadHeaderSettings(), persisted };
}

export function getVisibleNavItems(): HeaderNavItem[] {
  return loadHeaderSettings()
    .nav.filter((item) => item.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
