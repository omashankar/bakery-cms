import type {
  ActiveSession,
  FailedLoginAttempt,
  LoginHistoryEntry,
  RegisteredDevice,
  SecurityCenterState,
} from "@/types/security";
import {
  revokeSessionRequest,
  logoutAllRequest,
} from "./security-center-api";

const STORAGE_KEY = "bakery-cms-security-center";
const CURRENT_SESSION_KEY = "bakery-cms-current-session-id";
const MAX_HISTORY = 50;
const MAX_FAILED = 30;
export const SECURITY_CENTER_UPDATED_EVENT = "bakery-security-center-updated";

function nowIso(): string {
  return new Date().toISOString();
}



function notify(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SECURITY_CENTER_UPDATED_EVENT));
}

function persist(state: SecurityCenterState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  notify();
}

function parseUserAgent(): { browser: string; os: string; deviceLabel: string } {
  if (typeof navigator === "undefined") {
    return { browser: "Unknown", os: "Unknown", deviceLabel: "Unknown device" };
  }

  const ua = navigator.userAgent;
  let browser = "Browser";
  if (ua.includes("Edg/")) browser = "Microsoft Edge";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";

  let os = "Desktop";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  const deviceLabel = `${browser} on ${os}`;
  return { browser, os, deviceLabel };
}


/**
 * Empty, all four of them.
 *
 * This shipped a login history, a failed-attempt list, an active-session
 * list and a device list — invented rows with real-looking IP addresses,
 * a randomised `103.45.128.x`, and timestamps a couple of hours old. The
 * Security Centre renders them exactly as it renders the real ones.
 *
 * On a security screen that is not placeholder content. An owner scanning
 * their login history for something they do not recognise was reading
 * fiction, and the one thing that page exists for is to be believed. The
 * activity log was emptied for the same reason; these are the same problem
 * with a sharper edge, because a stranger's IP in a login list is exactly
 * what someone would act on.
 *
 * Real sessions come from the server (`/api/security-center`), so the tab
 * that matters is unaffected.
 */
/**
 * The browser does not know its own public address, so it does not claim to.
 *
 * This was `UNKNOWN_IP`: `"103.45.128." + a random number`. Every login this
 * client recorded got a fabricated IP that looks exactly like a real one, in
 * the list an owner scans for a sign-in they do not recognise. An empty
 * value renders as "Unknown", which is true and cannot be mistaken for
 * evidence.
 *
 * The real address is on the server's audit trail, which the page already
 * merges in.
 */
const UNKNOWN_IP = "";

function seedSecurityCenter(): SecurityCenterState {
  return {
    loginHistory: [],
    failedAttempts: [],
    activeSessions: [],
    devices: [],
    updatedAt: nowIso(),
  };
}

export function loadSecurityCenter(): SecurityCenterState {
  if (typeof window === "undefined") return seedSecurityCenter();

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = seedSecurityCenter();
    persist(seeded);
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as SecurityCenterState;
    if (!parsed.loginHistory) return seedSecurityCenter();
    return parsed;
  } catch {
    const seeded = seedSecurityCenter();
    persist(seeded);
    return seeded;
  }
}

function save(state: SecurityCenterState): SecurityCenterState {
  const next = { ...state, updatedAt: nowIso() };
  persist(next);
  return next;
}

/**
 * Hydration: replace the local cache with the server-DERIVED state (login trail
 * from the audit log, active sessions from live session rows). No re-push.
 */
export function persistServerSecurityCenter(state: SecurityCenterState): void {
  persist(state);
}

export function getLoginHistory(): LoginHistoryEntry[] {
  return loadSecurityCenter().loginHistory;
}

export function getFailedLoginAttempts(): FailedLoginAttempt[] {
  return loadSecurityCenter().failedAttempts;
}

export function getActiveSessions(): ActiveSession[] {
  return loadSecurityCenter().activeSessions;
}

export function getRegisteredDevices(): RegisteredDevice[] {
  return loadSecurityCenter().devices;
}

export function recordLoginSuccess(email: string): void {
  const state = loadSecurityCenter();
  const { browser, os, deviceLabel } = parseUserAgent();
  const ip = UNKNOWN_IP;
  const sessionId = `sess-${Date.now()}`;

  const historyEntry: LoginHistoryEntry = {
    id: `lh-${Date.now()}`,
    email,
    success: true,
    ipAddress: ip,
    deviceLabel,
    browser,
    os,
    timestamp: nowIso(),
  };

  const session: ActiveSession = {
    id: sessionId,
    email,
    deviceLabel,
    browser,
    os,
    ipAddress: ip,
    signedInAt: nowIso(),
    lastActiveAt: nowIso(),
    isCurrent: true,
  };

  const deviceIndex = state.devices.findIndex((d) => d.label === deviceLabel);
  const devices =
    deviceIndex >= 0
      ? state.devices.map((d, i) =>
          i === deviceIndex ? { ...d, lastSeenAt: nowIso(), ipAddress: ip } : d
        )
      : [
          {
            id: `dev-${Date.now()}`,
            label: deviceLabel,
            browser,
            os,
            ipAddress: ip,
            lastSeenAt: nowIso(),
            trusted: true,
          },
          ...state.devices,
        ];

  save({
    ...state,
    loginHistory: [historyEntry, ...state.loginHistory].slice(0, MAX_HISTORY),
    activeSessions: [
      session,
      ...state.activeSessions.map((s) => ({ ...s, isCurrent: false })),
    ].slice(0, 8),
    devices,
  });

  localStorage.setItem(CURRENT_SESSION_KEY, sessionId);
}

export function recordFailedLogin(email: string, reason = "Invalid password"): void {
  const state = loadSecurityCenter();
  const { browser, os, deviceLabel } = parseUserAgent();

  const historyEntry: LoginHistoryEntry = {
    id: `lh-${Date.now()}`,
    email,
    success: false,
    ipAddress: UNKNOWN_IP,
    deviceLabel,
    browser,
    os,
    timestamp: nowIso(),
  };

  const failed: FailedLoginAttempt = {
    id: `fa-${Date.now()}`,
    email,
    ipAddress: UNKNOWN_IP,
    reason,
    timestamp: nowIso(),
  };

  save({
    ...state,
    loginHistory: [historyEntry, ...state.loginHistory].slice(0, MAX_HISTORY),
    failedAttempts: [failed, ...state.failedAttempts].slice(0, MAX_FAILED),
  });
}

/**
 * Revoke a session — SERVER FIRST, and the local list only once it agrees.
 *
 * Every other write in this file is local-first for a responsive UI. This one is
 * not, and deliberately: it is an access control. Removing the row first meant a
 * failed DELETE (expired admin token, 500, offline) left the attacker's session
 * live on the server while the admin was shown "Session revoked" and the row
 * they would have retried was already gone from the list.
 */
export async function revokeSession(sessionId: string): Promise<boolean> {
  const state = loadSecurityCenter();
  const session = state.activeSessions.find((s) => s.id === sessionId);
  if (!session || session.isCurrent) return false;

  // Deletes the session and revokes its refresh chain.
  if (!(await revokeSessionRequest(sessionId))) return false;

  save({
    ...state,
    activeSessions: state.activeSessions.filter((s) => s.id !== sessionId),
  });
  return true;
}

export interface LogoutAllResult {
  /** How many sessions the SERVER revoked. Zero is a no-op, not a failure. */
  removed: number;
  /** Whether the server actually revoked them. */
  persisted: boolean;
}

/** Server first, for the same reason as [revokeSession]. */
export async function logoutAllDevices(): Promise<LogoutAllResult> {
  const state = loadSecurityCenter();
  const currentId = localStorage.getItem(CURRENT_SESSION_KEY) ?? "sess-current";
  const remaining = state.activeSessions.filter((s) => s.id === currentId || s.isCurrent);

  // Revokes all sessions other than the caller's. The count is the server's —
  // the cached list is a snapshot from page load and routinely disagrees.
  const { ok, revoked } = await logoutAllRequest();
  if (!ok) return { removed: 0, persisted: false };

  save({
    ...state,
    activeSessions: remaining.map((s) => ({ ...s, isCurrent: true })),
  });

  return { removed: revoked, persisted: true };
}

export function clearFailedLoginAttempts(): void {
  const state = loadSecurityCenter();
  save({ ...state, failedAttempts: [] });
}

export function toggleDeviceTrust(deviceId: string): RegisteredDevice | null {
  const state = loadSecurityCenter();
  const index = state.devices.findIndex((d) => d.id === deviceId);
  if (index === -1) return null;

  const devices = [...state.devices];
  devices[index] = { ...devices[index], trusted: !devices[index].trusted };
  save({ ...state, devices });
  return devices[index];
}

export function touchCurrentSession(): void {
  const state = loadSecurityCenter();
  const currentId = localStorage.getItem(CURRENT_SESSION_KEY);
  if (!currentId) return;

  const activeSessions = state.activeSessions.map((s) =>
    s.id === currentId || s.isCurrent ? { ...s, lastActiveAt: nowIso(), isCurrent: true } : s
  );

  if (activeSessions.some((s) => s.isCurrent)) {
    save({ ...state, activeSessions });
  }
}
