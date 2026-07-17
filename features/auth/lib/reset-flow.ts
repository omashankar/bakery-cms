const RESET_FLOW_KEY = "bakery-cms-reset-flow";

export interface ResetFlowState {
  /** Email the code was sent to — shown on the OTP step. */
  email: string;
  /** True once the OTP step passed, gating the reset-password step. */
  verified: boolean;
}

/**
 * Password-reset flow state, shared across /forgot-password -> /otp -> /reset-password.
 * sessionStorage on purpose: a half-finished reset must not survive a browser restart.
 */
function read(): ResetFlowState | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(RESET_FLOW_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ResetFlowState;
    return typeof parsed?.email === "string" && parsed.email ? parsed : null;
  } catch {
    return null;
  }
}

function write(state: ResetFlowState): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(RESET_FLOW_KEY, JSON.stringify(state));
  } catch {
    // Non-fatal: the step guards fall back to restarting the flow.
  }
}

export function startResetFlow(email: string): void {
  write({ email: email.trim(), verified: false });
}

export function getResetFlow(): ResetFlowState | null {
  return read();
}

export function markResetVerified(): void {
  const current = read();
  if (!current) return;
  write({ ...current, verified: true });
}

export function clearResetFlow(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(RESET_FLOW_KEY);
}
