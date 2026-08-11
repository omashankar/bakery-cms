const CUSTOMER_SESSION_KEY = "bakery-cms-customer-session";

export interface CustomerSession {
  email: string;
  name: string;
  phone?: string;
  signedInAt: string;
}

/** UI-only customer session — replaced by real auth later */
export function setCustomerSession(
  session: Omit<CustomerSession, "signedInAt">,
  remember = true
) {
  if (typeof window === "undefined") return;
  const payload: CustomerSession = {
    ...session,
    signedInAt: new Date().toISOString(),
  };
  // Clear both first. getCustomerSession prefers localStorage, so a leftover "remember me"
  // session would shadow a session-only sign-in — surviving restart and keeping the old email.
  localStorage.removeItem(CUSTOMER_SESSION_KEY);
  sessionStorage.removeItem(CUSTOMER_SESSION_KEY);
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(payload));
  window.dispatchEvent(new Event("bakery-customer-session-updated"));
}

export function getCustomerSession(): CustomerSession | null {
  if (typeof window === "undefined") return null;
  const raw =
    localStorage.getItem(CUSTOMER_SESSION_KEY) ??
    sessionStorage.getItem(CUSTOMER_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CustomerSession;
  } catch {
    return null;
  }
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
 * Sign-out removed exactly one key, the session itself. There is no server-side
 * customer account here — `setCustomerSession` says so: "UI-only customer
 * session — replaced by real auth later" — which means signing out is the ONLY
 * boundary this data has. A partial clear is the surprising one.
 *
 * Proven in a browser before it was fixed: tests/e2e/shared-device.spec.ts.
 *
 * The CART goes too, deliberately. It is less sensitive than an address, but it
 * is still one person's shopping showing up under another person's name — and a
 * cart that survives into a different customer's session is worse than one that
 * has to be rebuilt.
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

export function clearCustomerSession() {
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

export function hasCustomerSession(): boolean {
  return getCustomerSession() !== null;
}

export function getCustomerDisplayName(): string {
  const session = getCustomerSession();
  if (!session) return "";
  return session.name || session.email.split("@")[0] || "Customer";
}

export function updateCustomerProfile(
  patch: Partial<Pick<CustomerSession, "name" | "email" | "phone">>
): CustomerSession | null {
  if (typeof window === "undefined") return null;

  const fromLocal = localStorage.getItem(CUSTOMER_SESSION_KEY);
  const fromSession = sessionStorage.getItem(CUSTOMER_SESSION_KEY);
  const raw = fromLocal ?? fromSession;
  if (!raw) return null;

  try {
    const current = JSON.parse(raw) as CustomerSession;
    const updated: CustomerSession = {
      ...current,
      ...patch,
      signedInAt: current.signedInAt,
    };
    const storage = fromLocal ? localStorage : sessionStorage;
    storage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("bakery-customer-session-updated"));
    return updated;
  } catch {
    return null;
  }
}
