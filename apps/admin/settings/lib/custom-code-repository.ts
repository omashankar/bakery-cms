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

/** Local write + durable server replace-all. Returns false if the write was refused. */
export function saveCustomCode(code: CustomCode): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(code));
  } catch {
    return false;
  }
  replaceCustomCodeRequest(code);
  window.dispatchEvent(new Event(CUSTOM_CODE_UPDATED_EVENT));
  return true;
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
