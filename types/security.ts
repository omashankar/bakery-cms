export interface LoginHistoryEntry {
  id: string;
  email: string;
  success: boolean;
  ipAddress: string;
  deviceLabel: string;
  browser: string;
  os: string;
  timestamp: string;
}

export interface FailedLoginAttempt {
  id: string;
  email: string;
  ipAddress: string;
  reason: string;
  timestamp: string;
}

export interface ActiveSession {
  id: string;
  email: string;
  deviceLabel: string;
  browser: string;
  os: string;
  ipAddress: string;
  signedInAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

export interface RegisteredDevice {
  id: string;
  label: string;
  browser: string;
  os: string;
  ipAddress: string;
  lastSeenAt: string;
  trusted: boolean;
}

export interface SecurityCenterState {
  loginHistory: LoginHistoryEntry[];
  failedAttempts: FailedLoginAttempt[];
  activeSessions: ActiveSession[];
  devices: RegisteredDevice[];
  updatedAt: string;
}
