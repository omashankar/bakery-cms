const SESSION_KEY = "bakery-cms-demo-session";

export interface DemoSession {
  email: string;
  signedInAt: string;
}

/** UI-only session helpers — replaced by real auth later */
export function setDemoSession(email: string, remember = true) {
  if (typeof window === "undefined") return;
  const payload: DemoSession = {
    email,
    signedInAt: new Date().toISOString(),
  };
  // Clear both first. getDemoSession prefers localStorage, so a leftover "remember me"
  // session would shadow a session-only sign-in — surviving restart and keeping the old email.
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(SESSION_KEY, JSON.stringify(payload));
}

export function getDemoSession(): DemoSession | null {
  if (typeof window === "undefined") return null;
  const raw =
    localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DemoSession;
  } catch {
    return null;
  }
}

export function clearDemoSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export function hasDemoSession(): boolean {
  return getDemoSession() !== null;
}
