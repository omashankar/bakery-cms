import type { CustomerAdminMeta } from "@/types/customer";

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

function writeAllMeta(store: Record<string, CustomerAdminMeta>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  emitCustomersUpdated();
}

export function getCustomerAdminMeta(email: string): CustomerAdminMeta {
  const key = email.trim().toLowerCase();
  const store = readAllMeta();
  return store[key] ?? defaultCustomerAdminMeta(key);
}

export function saveCustomerAdminMeta(meta: CustomerAdminMeta): CustomerAdminMeta {
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
  return saved;
}

export function updateCustomerNotes(email: string, notes: string): CustomerAdminMeta {
  return saveCustomerAdminMeta({
    ...getCustomerAdminMeta(email),
    notes,
  });
}

export function updateCustomerMarketingOptIn(
  email: string,
  marketingOptIn: boolean
): CustomerAdminMeta {
  return saveCustomerAdminMeta({
    ...getCustomerAdminMeta(email),
    marketingOptIn,
  });
}

export function addCustomerTag(email: string, tag: string): CustomerAdminMeta {
  const normalizedTag = tag.trim();
  if (!normalizedTag) return getCustomerAdminMeta(email);

  const meta = getCustomerAdminMeta(email);
  if (meta.tags.includes(normalizedTag)) return meta;

  return saveCustomerAdminMeta({
    ...meta,
    tags: [...meta.tags, normalizedTag],
  });
}

export function removeCustomerTag(email: string, tag: string): CustomerAdminMeta {
  const meta = getCustomerAdminMeta(email);
  return saveCustomerAdminMeta({
    ...meta,
    tags: meta.tags.filter((item) => item !== tag),
  });
}
