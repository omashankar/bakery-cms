import { safeSetItem } from "@/lib/safe-storage";
import { hasCustomerSession } from "@/apps/website/account/lib/customer-session";
import type { CheckoutAddress } from "@/features/orders/lib/checkout-draft";

/**
 * THIS DEVICE'S COPY of the address book. The account's copy is on the server
 * (`/api/customer-auth/addresses`); this one is what the screens read
 * synchronously, kept in step by `syncSavedAddresses` and by every write.
 *
 * The book lived ONLY here, so an address saved on a phone was missing on the
 * laptop and clearing site data lost all of it — the same device-bound flaw
 * My Orders had before it read the shop's records.
 */
const ADDRESSES_STORAGE_KEY = "bakery-cms-customer-addresses";
/**
 * Set while this device holds a change the server has not acknowledged. A
 * sync then PUSHES instead of pulling, so a save made offline is not
 * overwritten by the older list still on the server. Cleared on sign-out with
 * the book itself (customer-session.ts).
 */
export const ADDRESSES_DIRTY_KEY = "bakery-cms-customer-addresses-dirty";
const ADDRESSES_ENDPOINT = "/api/customer-auth/addresses";

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

/**
 * Write this device's copy and, for a signed-in customer, the account's.
 *
 * `push: false` is for writing what the SERVER just sent, which must not be
 * sent straight back. A guest's book stays on the device: there is no account
 * to put it on, and checkout still offers it.
 */
function writeAddresses(addresses: SavedAddress[], { push = true } = {}): void {
  if (typeof window === "undefined") return;
  safeSetItem(ADDRESSES_STORAGE_KEY, JSON.stringify(addresses));
  window.dispatchEvent(new Event("bakery-addresses-updated"));
  if (push && hasCustomerSession()) {
    safeSetItem(ADDRESSES_DIRTY_KEY, "1");
    void queue(() => pushAddresses(addresses));
  }
}

/**
 * One request at a time, in order. Two quick saves must reach the server as
 * first-then-second; racing, the older list could land last and win.
 */
let pending: Promise<unknown> = Promise.resolve();
function queue<T>(task: () => Promise<T>): Promise<T> {
  const run = pending.then(task, task);
  pending = run.catch(() => undefined);
  return run;
}

async function pushAddresses(addresses: SavedAddress[]): Promise<boolean> {
  try {
    const res = await fetch(ADDRESSES_ENDPOINT, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ addresses }),
    });
    if (!res.ok) return false;
    // Only if nothing newer was written while this was in flight.
    if (JSON.stringify(readAddresses()) === JSON.stringify(addresses)) {
      localStorage.removeItem(ADDRESSES_DIRTY_KEY);
    }
    return true;
  } catch {
    // Left dirty: the next sync pushes again instead of pulling over it.
    return false;
  }
}

/**
 * Bring this device and the account into step. Returns the book as it now
 * stands, or null when there is nothing to sync against (a guest, or the
 * server could not be reached — the device copy stands in either case).
 *
 *   - this device has an unsent change: send it;
 *   - the account's book has ever been saved: it wins, and replaces this
 *     device's copy — even when it is empty, because an emptied book is a
 *     choice the customer made on another device;
 *   - it never has been, and this device has one: that is the customer's
 *     book from before the account kept it — upload it.
 */
export function syncSavedAddresses(): Promise<SavedAddress[] | null> {
  if (typeof window === "undefined" || !hasCustomerSession()) return Promise.resolve(null);

  return queue(async () => {
    const local = readAddresses();
    if (localStorage.getItem(ADDRESSES_DIRTY_KEY)) {
      return (await pushAddresses(local)) ? getSavedAddresses() : null;
    }
    try {
      const res = await fetch(ADDRESSES_ENDPOINT, { credentials: "same-origin" });
      if (!res.ok) return null;
      const body = (await res.json()) as {
        data?: { addresses?: SavedAddress[]; savedAt?: string | null };
      };
      const remote = Array.isArray(body.data?.addresses) ? body.data.addresses : [];
      if (body.data?.savedAt) {
        writeAddresses(remote, { push: false });
      } else if (local.length > 0) {
        await pushAddresses(local);
      }
      return getSavedAddresses();
    } catch {
      return null;
    }
  });
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

/**
 * `crypto.randomUUID` is undefined outside a secure context.
 *
 * A shop reached over plain HTTP on a LAN — a tablet on the counter — has no
 * `crypto.randomUUID`, so "Save address" threw before its success toast, and
 * the same call at checkout silently no-opped. `newOrderId` in
 * features/orders/lib/orders.ts carries this exact fallback and a comment
 * saying why; this twin did not.
 */
function newAddressId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `addr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createSavedAddress(input: SavedAddressInput): SavedAddress {
  const now = new Date().toISOString();
  const addresses = readAddresses();
  const shouldBeDefault = input.isDefault || addresses.length === 0;

  const created: SavedAddress = {
    ...input,
    id: newAddressId(),
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
