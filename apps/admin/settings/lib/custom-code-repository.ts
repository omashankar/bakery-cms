import {
  replaceCustomCodeRequest,
} from "@/features/admin-config/lib/admin-config-api";

const STORAGE_KEY = "bakery-cms-custom-code";
export const CUSTOM_CODE_UPDATED_EVENT = "bakery-custom-code-updated";

export interface CustomCode {
  css: string;
  js: string;
}

export const EMPTY_CUSTOM_CODE: CustomCode = { css: "", js: "" };

export function loadCustomCode(): CustomCode {
  if (typeof window === "undefined") return EMPTY_CUSTOM_CODE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_CUSTOM_CODE;
    const parsed = JSON.parse(raw) as Partial<CustomCode>;
    return { css: parsed.css ?? "", js: parsed.js ?? "" };
  } catch {
    return EMPTY_CUSTOM_CODE;
  }
}

/**
 * False when the code did not reach the SERVER. This is script and style
 * injected into every storefront page, rendered from the server copy — a
 * local-only save changes nothing any visitor sees.
 */
export async function saveCustomCode(code: CustomCode): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const previous = localStorage.getItem(STORAGE_KEY);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(code));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(CUSTOM_CODE_UPDATED_EVENT));

  const persisted = await replaceCustomCodeRequest(code);

  // Undo the local write when the server refuses. `ensureAdminConfigHydrated`
  // returns early once it has settled, so nothing re-read the server for the
  // rest of the session — a refused CLEAR left the browser believing the
  // shop had no custom code at all. Restored only if this write is still the
  // one in the cache, so a concurrent accepted save is not destroyed.
  if (!persisted) {
    const stillOurs = localStorage.getItem(STORAGE_KEY) === JSON.stringify(code);
    if (stillOurs) {
      if (previous === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, previous);
      window.dispatchEvent(new Event(CUSTOM_CODE_UPDATED_EVENT));
    }
  }

  return persisted;
}

/** Hydration: apply the server's custom code into the local cache (no re-push). */
export function persistServerCustomCode(code: CustomCode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(code));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(CUSTOM_CODE_UPDATED_EVENT));
}
