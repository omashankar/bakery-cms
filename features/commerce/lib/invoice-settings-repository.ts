import type { InvoiceSettings, InvoiceSettingsFormData } from "@/types/invoice";
import {
  defaultInvoiceSettings,
  mergeInvoiceSettings,
} from "./invoice-defaults";

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

export function saveInvoiceSettings(data: InvoiceSettingsFormData): InvoiceSettings {
  const next: InvoiceSettings = {
    ...mergeInvoiceSettings(data),
    updatedAt: nowIso(),
  };
  writeSettings(next);
  localStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
  return next;
}

export function resetInvoiceSettings(): InvoiceSettings {
  const seeded = { ...defaultInvoiceSettings, updatedAt: nowIso() };
  writeSettings(seeded);
  localStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
  return seeded;
}
