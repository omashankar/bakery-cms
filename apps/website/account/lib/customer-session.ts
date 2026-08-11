const CUSTOMER_SESSION_KEY = "bakery-cms-customer-session";

export interface CustomerSession {
  email: string;
  name: string;
  phone?: string;
  signedInAt: string;
}

/**
 * WHO IS SIGNED IN — the browser's copy of an answer the SERVER owns.
 *
 * This used to be the whole of it. `setCustomerSession` said so: "UI-only
 * customer session — replaced by real auth later". Anyone could type any email
 * into the sign-in box and be that person as far as the shop was concerned, the
 * phone flow minted `<phone>@customer.local` identities that matched no order
 * ever placed, and My Orders read this browser's order cache — so a customer's
 * history was device-bound, frozen at the moment of placing, and blind to an
 * order the payment webhook had placed on their behalf.
 *
 * Now there is a real account behind it (`/api/customer-auth/*`), proved by a
 * one-time code emailed to the address, carried in an httpOnly cookie this file
 * cannot read.
 *
 * What is left here is a CACHE, and only a cache: it exists so the header can
 * render an account menu on the first paint instead of flashing "Login" for the
 * length of a round trip. Nothing that matters may be decided from it. Every
 * answer about a customer's orders comes from the server, which reads the
 * cookie and ignores anything the browser claims.
 */

/** True once `syncCustomerSession` has had an answer from the server. */
let settled = false;

export function hasCustomerSessionSettled(): boolean {
  return settled;
}

function readCache(): CustomerSession | null {
  if (typeof window === "undefined") return null;
  const raw =
    localStorage.getItem(CUSTOMER_SESSION_KEY) ?? sessionStorage.getItem(CUSTOMER_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CustomerSession;
  } catch {
    return null;
  }
}

function writeCache(session: CustomerSession | null): void {
  if (typeof window === "undefined") return;
  if (session) localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(CUSTOMER_SESSION_KEY);
  sessionStorage.removeItem(CUSTOMER_SESSION_KEY);
  window.dispatchEvent(new Event("bakery-customer-session-updated"));
}

export function getCustomerSession(): CustomerSession | null {
  return readCache();
}

export function hasCustomerSession(): boolean {
  return getCustomerSession() !== null;
}

/**
 * Ask the server who is signed in, and cache the answer.
 *
 * The one place the cache is filled. Called on mount by the storefront header,
 * so every page corrects a stale copy — including one left behind by a session
 * that has since expired, been signed out on another tab, or had its account
 * blocked.
 */
export async function syncCustomerSession(): Promise<CustomerSession | null> {
  if (typeof window === "undefined") return null;

  try {
    const res = await fetch("/api/customer-auth/me", { credentials: "same-origin" });
    if (!res.ok) return readCache();

    const body = (await res.json()) as {
      data?: { email: string; name: string; phone?: string } | null;
    };
    settled = true;

    if (!body.data) {
      // The server says nobody. A cache that disagrees is a stale copy, and
      // leaving it would keep an account menu on screen for a signed-out
      // browser — and, on a shared device, someone else's name.
      if (readCache()) clearLocalCustomerData();
      return null;
    }

    const current = readCache();
    const session: CustomerSession = {
      email: body.data.email,
      name: body.data.name,
      phone: body.data.phone,
      // Kept from the cached copy where we have one; this is display trivia,
      // not authority.
      signedInAt: current?.signedInAt ?? new Date().toISOString(),
    };
    writeCache(session);
    return session;
  } catch {
    // Offline: keep showing what we had rather than pretending they signed out.
    return readCache();
  }
}

/** Adopt an identity the server has just confirmed (the sign-in modal). */
export function adoptCustomerSession(identity: {
  email: string;
  name: string;
  phone?: string;
}): CustomerSession {
  const session: CustomerSession = { ...identity, signedInAt: new Date().toISOString() };
  writeCache(session);
  settled = true;
  return session;
}

/**
 * Everything this device is holding ON BEHALF OF the signed-in customer.
 *
 * None of it is scoped to them. Saved addresses are one browser-wide array —
 * `bakery-cms-customer-addresses` — with nothing in the key or the records
 * tying an entry to whoever saved it, and checkout offers them as a picker. So
 * on a bakery's own tablet, a family computer or an internet café, the next
 * person to sign in was handed the previous customer's full name, phone number
 * and street address, ready to deliver a cake to.
 *
 * Proven in a browser before it was fixed: tests/e2e/shared-device.spec.ts.
 *
 * The CART goes too, deliberately. It is less sensitive than an address, but it
 * is still one person's shopping showing up under another person's name.
 *
 * `bakery-cms-orders` is NOT in this list: it is the local order cache, read
 * through `getOrdersForCustomer(session.email)`, so it is already filtered by
 * whoever is signed in and clearing it would lose a customer's own order
 * history on every sign-out.
 */
const CUSTOMER_DEVICE_KEYS = [
  "bakery-cms-customer-addresses",
  "bakery-cms-cart",
  "bakery-cms-cart-preferences",
  "bakery-cms-saved-for-later",
  "bakery-cms-wishlist",
  "bakery-cms-checkout-draft",
  // Which order numbers this browser has proved ownership of, by email.
  "bakery-cms-verified-orders",
  // A held payment carries the previous customer's order number and payment
  // reference, and the checkout overlay puts both on screen. The order itself
  // stays in `bakery-cms-orders`, so signing out loses them nothing.
  "bakery-cms-unconfirmed-order",
] as const;

/** Wipe this device's copy. Does NOT end the server session — see `signOutCustomer`. */
function clearLocalCustomerData(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(CUSTOMER_SESSION_KEY);
  sessionStorage.removeItem(CUSTOMER_SESSION_KEY);

  for (const key of CUSTOMER_DEVICE_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }

  // The screens that render these read them on their own events, not on the
  // session one, so each has to be told or the page keeps showing what was
  // just removed.
  window.dispatchEvent(new Event("bakery-customer-session-updated"));
  window.dispatchEvent(new Event("bakery-cart-updated"));
  window.dispatchEvent(new Event("bakery-cart-preferences-updated"));
  window.dispatchEvent(new Event("bakery-addresses-updated"));
  window.dispatchEvent(new Event("bakery-wishlist-updated"));
  window.dispatchEvent(new Event("bakery-saved-for-later-updated"));
}

/**
 * Sign out — on the SERVER first, then this device.
 *
 * Returns whether the server actually ended the session. Clearing the local
 * copy while the cookie survives would be the worst of both: the customer sees
 * a signed-out shop, and the next request still carries their session.
 */
export async function signOutCustomer(): Promise<boolean> {
  let endedOnServer = false;
  try {
    const res = await fetch("/api/customer-auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    endedOnServer = res.ok;
  } catch {
    endedOnServer = false;
  }

  // The device is wiped either way: whatever happened to the cookie, leaving
  // one customer's addresses and cart on a shared machine is not an option.
  clearLocalCustomerData();
  settled = true;
  return endedOnServer;
}

export function getCustomerDisplayName(): string {
  const session = getCustomerSession();
  if (!session) return "";
  return session.name || session.email.split("@")[0] || "Customer";
}

/**
 * Change the customer's own name or phone, on the server.
 *
 * The email is NOT editable here any more. It is the account key and the key
 * every order is matched on, so editing it locally used to disconnect a
 * customer from their entire history under a toast reading "Profile updated".
 * Changing it now means signing in as that address and proving it.
 */
export async function updateCustomerProfile(patch: {
  name: string;
  phone?: string;
}): Promise<CustomerSession | null> {
  if (typeof window === "undefined") return null;

  try {
    const res = await fetch("/api/customer-auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(patch),
    });
    if (!res.ok) return null;

    const body = (await res.json()) as { data?: { email: string; name: string; phone?: string } };
    if (!body.data) return null;
    return adoptCustomerSession(body.data);
  } catch {
    return null;
  }
}
