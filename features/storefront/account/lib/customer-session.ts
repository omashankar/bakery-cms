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

export function clearCustomerSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CUSTOMER_SESSION_KEY);
  sessionStorage.removeItem(CUSTOMER_SESSION_KEY);
  window.dispatchEvent(new Event("bakery-customer-session-updated"));
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
