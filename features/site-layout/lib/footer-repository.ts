import type { FooterSettings } from "@/types/site-layout";
import { defaultFooterSettings } from "./footer-utils";
import { replaceFooterRequest } from "./site-layout-api";
import type { WriteResult } from "@/lib/write-result";

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
      // `undefined` is an absence; `[]` is the shop saying there are none.
      // Treating both as absent meant a shop that deleted every row got the
      // DEMO set back in the editor — and the next save published it. The
      // server already keeps an empty list (`cms-store` seeds only an absent
      // collection), so the two disagreed about the same shop.
      columns: parsed.columns ?? defaultFooterSettings.columns,
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
async function persistAndSync(next: FooterSettings): Promise<boolean> {
  const previous = typeof window === "undefined" ? null : localStorage.getItem(STORAGE_KEY);

  persist(next);
  const accepted = await replaceFooterRequest(next);

  if (!accepted && typeof window !== "undefined") {
    const stillOurs = localStorage.getItem(STORAGE_KEY) === JSON.stringify(next);
    if (stillOurs) {
      if (previous === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, previous);
    }
  }

  return accepted;
}

export async function saveFooterSettings(
  settings: FooterSettings
): Promise<WriteResult<FooterSettings>> {
  const next = { ...settings, updatedAt: nowIso() };
  return { value: next, persisted: await persistAndSync(next) };
}

/** Hydration: apply the server's footer settings locally (no re-push). */
export function persistServerFooter(settings: FooterSettings): void {
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
export async function resetFooterSettings(): Promise<WriteResult<FooterSettings>> {
  const persisted = await persistAndSync(defaultFooterSettings);

  // On refusal, hand back what is ACTUALLY in place — the rollback has just
  // restored it — rather than what was attempted.
  return { value: persisted ? defaultFooterSettings : loadFooterSettings(), persisted };
}
