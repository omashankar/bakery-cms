/**
 * Client-side invoice settings API. Best-effort dual-write + hydrate. Returns
 * null on failure so the localStorage flow keeps working offline/unauthenticated.
 */
import type { InvoiceSettings, InvoiceSettingsFormData } from "@/types/invoice";

interface Envelope<T> {
  success: boolean;
  data: T | null;
}

export async function fetchInvoiceSettings(): Promise<Partial<InvoiceSettings> | null> {
  try {
    const res = await fetch("/api/payments/invoice-settings", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<Partial<InvoiceSettings>>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

/**
 * Whether the SERVER accepted the invoice settings. Never throws.
 *
 * These are the shop's legal identity on every invoice — business name, GSTIN,
 * address, terms. Fire-and-forget meant an admin could correct a wrong GSTIN,
 * be told it saved, and keep issuing invoices with the old one.
 */
export async function saveInvoiceSettingsRequest(
  data: InvoiceSettingsFormData
): Promise<boolean> {
  try {
    const res = await fetch("/api/payments/invoice-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}
