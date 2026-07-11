import type {
  ActiveSession,
  FailedLoginAttempt,
  LoginHistoryEntry,
  RegisteredDevice,
  SecurityCenterState,
} from "@/types/security";

const STORAGE_KEY = "bakery-cms-security-center";
const CURRENT_SESSION_KEY = "bakery-cms-current-session-id";
const MAX_HISTORY = 50;
const MAX_FAILED = 30;
export const SECURITY_CENTER_UPDATED_EVENT = "bakery-security-center-updated";

function nowIso(): string {
  return new Date().toISOString();
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600000).toISOString();
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

function demoIp(): string {
  return "103.45.128." + (Math.floor(Math.random() * 200) + 10);
}

function seedSecurityCenter(): SecurityCenterState {
  const { browser, os, deviceLabel } = parseUserAgent();

  return {
    loginHistory: [
      {
        id: "lh-1",
        email: "admin@bakery.com",
        success: true,
        ipAddress: "103.45.128.42",
        deviceLabel: "Chrome on Windows",
        browser: "Chrome",
        os: "Windows",
        timestamp: hoursAgo(2),
      },
      {
        id: "lh-2",
        email: "admin@bakery.com",
        success: false,
        ipAddress: "49.36.201.18",
        deviceLabel: "Safari on iOS",
        browser: "Safari",
        os: "iOS",
        timestamp: daysAgo(1),
      },
      {
        id: "lh-3",
        email: "admin@bakery.com",
        success: true,
        ipAddress: "103.45.128.42",
        deviceLabel: "Chrome on Windows",
        browser: "Chrome",
        os: "Windows",
        timestamp: daysAgo(2),
      },
      {
        id: "lh-4",
        email: "manager@bakery.com",
        success: false,
        ipAddress: "182.76.44.91",
        deviceLabel: "Firefox on Linux",
        browser: "Firefox",
        os: "Linux",
        timestamp: daysAgo(3),
      },
      {
        id: "lh-5",
        email: "admin@bakery.com",
        success: true,
        ipAddress: "103.45.128.42",
        deviceLabel: "Chrome on Windows",
        browser: "Chrome",
        os: "Windows",
        timestamp: daysAgo(5),
      },
    ],
    failedAttempts: [
      {
        id: "fa-1",
        email: "admin@bakery.com",
        ipAddress: "49.36.201.18",
        reason: "Invalid password",
        timestamp: daysAgo(1),
      },
      {
        id: "fa-2",
        email: "manager@bakery.com",
        ipAddress: "182.76.44.91",
        reason: "Account not found",
        timestamp: daysAgo(3),
      },
    ],
    activeSessions: [
      {
        id: "sess-current",
        email: "admin@bakery.com",
        deviceLabel,
        browser,
        os,
        ipAddress: "103.45.128.42",
        signedInAt: hoursAgo(2),
        lastActiveAt: nowIso(),
        isCurrent: true,
      },
      {
        id: "sess-2",
        email: "admin@bakery.com",
        deviceLabel: "Safari on iOS",
        browser: "Safari",
        os: "iOS",
        ipAddress: "49.36.201.18",
        signedInAt: daysAgo(4),
        lastActiveAt: daysAgo(1),
        isCurrent: false,
      },
    ],
    devices: [
      {
        id: "dev-1",
        label: deviceLabel,
        browser,
        os,
        ipAddress: "103.45.128.42",
        lastSeenAt: nowIso(),
        trusted: true,
      },
      {
        id: "dev-2",
        label: "Safari on iOS",
        browser: "Safari",
        os: "iOS",
        ipAddress: "49.36.201.18",
        lastSeenAt: daysAgo(1),
        trusted: true,
      },
      {
        id: "dev-3",
        label: "Firefox on Linux",
        browser: "Firefox",
        os: "Linux",
        ipAddress: "182.76.44.91",
        lastSeenAt: daysAgo(3),
        trusted: false,
      },
    ],
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
  const ip = demoIp();
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
    ipAddress: demoIp(),
    deviceLabel,
    browser,
    os,
    timestamp: nowIso(),
  };

  const failed: FailedLoginAttempt = {
    id: `fa-${Date.now()}`,
    email,
    ipAddress: demoIp(),
    reason,
    timestamp: nowIso(),
  };

  save({
    ...state,
    loginHistory: [historyEntry, ...state.loginHistory].slice(0, MAX_HISTORY),
    failedAttempts: [failed, ...state.failedAttempts].slice(0, MAX_FAILED),
  });
}

export function revokeSession(sessionId: string): boolean {
  const state = loadSecurityCenter();
  const session = state.activeSessions.find((s) => s.id === sessionId);
  if (!session || session.isCurrent) return false;

  save({
    ...state,
    activeSessions: state.activeSessions.filter((s) => s.id !== sessionId),
  });
  return true;
}

export function logoutAllDevices(): number {
  const state = loadSecurityCenter();
  const currentId = localStorage.getItem(CURRENT_SESSION_KEY) ?? "sess-current";
  const remaining = state.activeSessions.filter((s) => s.id === currentId || s.isCurrent);
  const removed = state.activeSessions.length - remaining.length;

  save({
    ...state,
    activeSessions: remaining.map((s) => ({ ...s, isCurrent: true })),
  });

  return removed;
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
