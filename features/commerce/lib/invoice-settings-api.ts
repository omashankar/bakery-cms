/**
 * Client-side invoice settings API. Best-effort dual-write + hydrate. Returns
 * null on failure so the localStorage flow keeps working offline/unauthenticated.
 */
import { createHydrationGate } from "@/lib/hydration-gate";
import type { InvoiceSettings, InvoiceSettingsFormData } from "@/types/invoice";

interface Envelope<T> {
  success: boolean;
  data: T | null;
}

/**
 * Opened once the SERVER's invoice settings have been read into the local copy.
 *
 * A save here is a whole-document replace of the shop's legal identity —
 * company name, address, GSTIN, PAN, the terms printed on every invoice — and
 * `loadInvoiceSettings()` SEEDS demo constants into localStorage when the key
 * is absent. So a browser whose read failed (a cold serverless start, an
 * expired admin token) held the seed, and one click on Save replaced the shop's
 * real registration details with demo ones. Every other replace-all store in
 * the app already waits on a gate; this one had none.
 */
export const invoiceSettingsHydration = createHydrationGate();

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
  // Refuse to send a copy this browser cannot vouch for. Reporting `false`
  // surfaces as "saved on this device only" and keeps Save live for a retry,
  // which is the honest outcome — better than overwriting a real GSTIN with a
  // demo one and reporting success.
  if (!(await invoiceSettingsHydration.waitForSettled())) return false;

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
