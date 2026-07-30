import type { InvoiceSettings, InvoiceSettingsFormData } from "@/types/invoice";
import {
  defaultInvoiceSettings,
  mergeInvoiceSettings,
} from "./invoice-defaults";
import { saveInvoiceSettingsRequest } from "./invoice-settings-api";
import type { WriteResult } from "@/lib/write-result";

const STORAGE_KEY = "bakery-cms-invoice-settings";
const STORAGE_VERSION_KEY = "bakery-cms-invoice-settings-version";
const STORAGE_VERSION = 1;

export const INVOICE_SETTINGS_UPDATED_EVENT = "bakery-invoice-settings-updated";

function nowIso(): string {
  return new Date().toISOString();
}

function emitUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(INVOICE_SETTINGS_UPDATED_EVENT));
}

function writeSettings(settings: InvoiceSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  emitUpdated();
}

export function loadInvoiceSettings(): InvoiceSettings {
  if (typeof window === "undefined") return defaultInvoiceSettings;

  const version = localStorage.getItem(STORAGE_VERSION_KEY);
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw || version !== String(STORAGE_VERSION)) {
    const seeded = { ...defaultInvoiceSettings, updatedAt: nowIso() };
    writeSettings(seeded);
    localStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
    return seeded;
  }

  try {
    return mergeInvoiceSettings(JSON.parse(raw) as Partial<InvoiceSettings>);
  } catch {
    return defaultInvoiceSettings;
  }
}

export async function saveInvoiceSettings(
  data: InvoiceSettingsFormData
): Promise<WriteResult<InvoiceSettings>> {
  const next: InvoiceSettings = {
    ...mergeInvoiceSettings(data),
    updatedAt: nowIso(),
  };
  writeSettings(next);
  localStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
  return { value: next, persisted: await saveInvoiceSettingsRequest(data) };
}

/** Hydration: write the server's copy to the local cache without re-pushing. */
export function persistServerInvoiceSettings(data: Partial<InvoiceSettings>): void {
  writeSettings(mergeInvoiceSettings(data));
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
  }
}

export function resetInvoiceSettings(): InvoiceSettings {
  const seeded = { ...defaultInvoiceSettings, updatedAt: nowIso() };
  writeSettings(seeded);
  localStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
  return seeded;
}
