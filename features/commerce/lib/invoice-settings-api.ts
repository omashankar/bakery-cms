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

export function saveInvoiceSettingsRequest(data: InvoiceSettingsFormData): void {
  void (async () => {
    try {
      await fetch("/api/payments/invoice-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch {
      // best-effort
    }
  })();
}
