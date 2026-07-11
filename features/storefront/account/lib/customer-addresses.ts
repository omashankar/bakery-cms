import type { CheckoutAddress } from "@/features/storefront/checkout/lib/checkout-draft";

const ADDRESSES_STORAGE_KEY = "bakery-cms-customer-addresses";

export interface SavedAddress extends CheckoutAddress {
  id: string;
  label: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SavedAddressInput = Omit<SavedAddress, "id" | "createdAt" | "updatedAt">;

function readAddresses(): SavedAddress[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(ADDRESSES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedAddress[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAddresses(addresses: SavedAddress[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ADDRESSES_STORAGE_KEY, JSON.stringify(addresses));
  window.dispatchEvent(new Event("bakery-addresses-updated"));
}

export function getSavedAddresses(): SavedAddress[] {
  return readAddresses().sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function getDefaultAddress(): SavedAddress | null {
  return getSavedAddresses().find((address) => address.isDefault) ?? getSavedAddresses()[0] ?? null;
}

export function createSavedAddress(input: SavedAddressInput): SavedAddress {
  const now = new Date().toISOString();
  const addresses = readAddresses();
  const shouldBeDefault = input.isDefault || addresses.length === 0;

  const created: SavedAddress = {
    ...input,
    id: crypto.randomUUID(),
    isDefault: shouldBeDefault,
    createdAt: now,
    updatedAt: now,
  };

  const next = shouldBeDefault
    ? [created, ...addresses.map((item) => ({ ...item, isDefault: false }))]
    : [...addresses, created];

  writeAddresses(next);
  return created;
}

export function updateSavedAddress(
  id: string,
  patch: Partial<SavedAddressInput>
): SavedAddress | null {
  const addresses = readAddresses();
  const index = addresses.findIndex((item) => item.id === id);
  if (index < 0) return null;

  const updated: SavedAddress = {
    ...addresses[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  let next = [...addresses];
  next[index] = updated;

  if (patch.isDefault) {
    next = next.map((item) => ({
      ...item,
      isDefault: item.id === id,
    }));
  }

  writeAddresses(next);
  return updated;
}

export function deleteSavedAddress(id: string): void {
  const addresses = readAddresses().filter((item) => item.id !== id);
  if (addresses.length > 0 && !addresses.some((item) => item.isDefault)) {
    addresses[0] = { ...addresses[0], isDefault: true };
  }
  writeAddresses(addresses);
}

export function setDefaultSavedAddress(id: string): void {
  updateSavedAddress(id, { isDefault: true });
}
