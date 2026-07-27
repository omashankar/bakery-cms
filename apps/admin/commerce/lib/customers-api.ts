/**
 * Client-side customers API. Admin metadata (tags/notes/marketing) dual-writes
 * to the server and hydrates from it. Best-effort — never throws.
 */
import type { CustomerAdminMeta } from "@/types/customer";

interface Envelope<T> {
  success: boolean;
  data: T | null;
}

interface ServerCustomer {
  email: string;
  meta: CustomerAdminMeta;
}

export function saveCustomerMetaRequest(meta: CustomerAdminMeta): void {
  void (async () => {
    try {
      await fetch("/api/customers/meta", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(meta),
      });
    } catch {
      // best-effort
    }
  })();
}

/** Hydration: fetch the customers list and extract each one's metadata. */
export async function fetchCustomerMetaMap(): Promise<Record<string, CustomerAdminMeta> | null> {
  try {
    const res = await fetch("/api/customers", { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<ServerCustomer[]>;
    if (!json.success || !json.data) return null;
    const map: Record<string, CustomerAdminMeta> = {};
    for (const c of json.data) {
      if (c.meta) map[c.email.trim().toLowerCase()] = c.meta;
    }
    return map;
  } catch {
    return null;
  }
}
