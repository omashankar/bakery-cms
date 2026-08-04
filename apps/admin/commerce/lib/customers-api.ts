/**
 * Client-side customers API. Admin metadata (tags/notes/marketing) dual-writes
 * to the server and hydrates from it. Best-effort — never throws.
 */
import type { CustomerAdminMeta } from "@/types/customer";
import type { CustomerProfile } from "@/features/customers/lib/customer-profiles";
import type { PlacedOrder } from "@/features/orders/lib/orders";

interface Envelope<T> {
  success: boolean;
  data: T | null;
}

interface ServerCustomer {
  email: string;
  meta: CustomerAdminMeta;
}

/**
 * Resolves false when the server rejected the write.
 *
 * Customer notes and tags are the admin's own work — reporting them saved on the
 * strength of the localStorage write alone means a 401 or a 500 silently loses
 * them at the next hydration, and the admin never finds out.
 */
export async function saveCustomerMetaRequest(meta: CustomerAdminMeta): Promise<boolean> {
  try {
    const res = await fetch("/api/customers/meta", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(meta),
    });
    return res.ok;
  } catch {
    return false;
  }
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

/**
 * The full customer list, built server-side over EVERY order.
 *
 * The browser cannot compute this: a customer is the sum of their orders, and
 * the local order cache only ever holds the most recent slice — so older
 * customers were missing entirely and the rest understated their spend.
 */
export async function fetchCustomerProfiles(): Promise<CustomerProfile[] | null> {
  try {
    const res = await fetch("/api/customers", { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<CustomerProfile[]>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export interface CustomerDetailResponse {
  record: (CustomerProfile & { segment: CustomerProfile["segment"] }) | null;
  profile: CustomerProfile | null;
  orders: PlacedOrder[];
  meta: CustomerAdminMeta | null;
}

/**
 * One customer's profile plus their COMPLETE order history.
 *
 * Queried by email server-side rather than filtered out of the local cache, so a
 * long-standing customer's earliest orders are not simply missing.
 */
export async function fetchCustomerDetail(
  email: string,
): Promise<CustomerDetailResponse | null> {
  try {
    const res = await fetch(`/api/customers/${encodeURIComponent(email)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<CustomerDetailResponse>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}
