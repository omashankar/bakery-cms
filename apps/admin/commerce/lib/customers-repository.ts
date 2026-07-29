import type { CustomerAdminMeta } from "@/types/customer";
import { saveCustomerMetaRequest } from "./customers-api";

const STORAGE_KEY = "bakery-cms-customer-profiles";

export const CUSTOMERS_UPDATED_EVENT = "bakery-customers-updated";

export const defaultCustomerAdminMeta = (email: string): CustomerAdminMeta => ({
  email,
  tags: [],
  notes: "",
  marketingOptIn: true,
  updatedAt: new Date().toISOString(),
});

function emitCustomersUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CUSTOMERS_UPDATED_EVENT));
}

function readAllMeta(): Record<string, CustomerAdminMeta> {
  if (typeof window === "undefined") return {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CustomerAdminMeta>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Writes the local copy WITHOUT announcing it.
 *
 * The announcement has to wait for the server write. Listeners react by
 * refetching, and a refetch that starts before the server has the change reads
 * the old value back and paints over what the admin just typed.
 */
function writeAllMeta(store: Record<string, CustomerAdminMeta>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getCustomerAdminMeta(email: string): CustomerAdminMeta {
  const key = email.trim().toLowerCase();
  const store = readAllMeta();
  return store[key] ?? defaultCustomerAdminMeta(key);
}

/**
 * Writes locally, then to the server.
 *
 * `persisted` is false when the server rejected it — the local copy is only a
 * cache, so a rejected write is silently discarded at the next hydration and
 * the caller must not report it as saved.
 */
export interface CustomerMetaResult {
  meta: CustomerAdminMeta;
  persisted: boolean;
}

export async function saveCustomerAdminMeta(
  meta: CustomerAdminMeta
): Promise<CustomerMetaResult> {
  const key = meta.email.trim().toLowerCase();
  const saved: CustomerAdminMeta = {
    ...defaultCustomerAdminMeta(key),
    ...meta,
    email: key,
    updatedAt: new Date().toISOString(),
  };

  const store = readAllMeta();
  store[key] = saved;
  writeAllMeta(store);

  const persisted = await saveCustomerMetaRequest(saved);
  // Announce only after a write the server ACCEPTED. Listeners refetch when they
  // hear this; doing so before the write lands — or after one the server
  // rejected — reads the stale value back over the admin's own edit, while the
  // toast tells them it was kept.
  if (persisted) emitCustomersUpdated();

  return { meta: saved, persisted };
}

/** Hydration: merge the server's customer metadata into the local cache. */
export function persistServerCustomerMeta(
  metaByEmail: Record<string, CustomerAdminMeta>
): void {
  if (typeof window === "undefined") return;
  const store = readAllMeta();
  for (const [email, meta] of Object.entries(metaByEmail)) {
    store[email.trim().toLowerCase()] = meta;
  }
  writeAllMeta(store);
  // Safe to announce immediately — this IS the server's copy, so a listener
  // refetching cannot read back anything older than what just arrived.
  emitCustomersUpdated();
}

/**
 * Every one of these takes the CURRENT metadata rather than reading the local
 * cache for it.
 *
 * The screens that call them render the server's copy, and the local cache is
 * only opportunistically populated — so composing a write from the cache sent
 * whatever happened to be there. On a cold browser that is an empty record, and
 * removing one tag would have wiped every tag and note the server held.
 */
export function updateCustomerNotes(
  current: CustomerAdminMeta,
  notes: string
): Promise<CustomerMetaResult> {
  return saveCustomerAdminMeta({ ...current, notes });
}

export function updateCustomerMarketingOptIn(
  current: CustomerAdminMeta,
  marketingOptIn: boolean
): Promise<CustomerMetaResult> {
  return saveCustomerAdminMeta({ ...current, marketingOptIn });
}

export function addCustomerTag(
  current: CustomerAdminMeta,
  tag: string
): Promise<CustomerMetaResult> {
  const normalizedTag = tag.trim();
  // Nothing to write, so nothing could fail to persist.
  if (!normalizedTag || current.tags.includes(normalizedTag)) {
    return Promise.resolve({ meta: current, persisted: true });
  }

  return saveCustomerAdminMeta({ ...current, tags: [...current.tags, normalizedTag] });
}

export function removeCustomerTag(
  current: CustomerAdminMeta,
  tag: string
): Promise<CustomerMetaResult> {
  return saveCustomerAdminMeta({
    ...current,
    tags: current.tags.filter((item) => item !== tag),
  });
}
