import { toast } from "sonner";

import { sessionState } from "@/features/auth/lib/session-expiry";

/**
 * "The server rejected it" is wrong when the server did not know who was
 * asking, and it is the difference between "check your values" and "sign in
 * again". Both reporters below consult it, because the settings screens are
 * exactly where an admin sits still long enough to be timed out.
 *
 * Returns true when it has already told the admin what happened.
 */
function reportedAsSignedOut(): boolean {
  if (sessionState() !== "expired") return false;
  toast.error("Not saved — your session had ended", {
    description: "Sign in again in the dialog, then try once more.",
  });
  return true;
}

/**
 * Report a settings write honestly, and tell the caller whether it may treat the
 * section as saved.
 *
 * A section the server rejected is NOT saved. `SettingsServerSync` merges the
 * server's copy over the local one on the next admin page load, so the change is
 * silently reverted — and these are real settings: the session timeout, the
 * maintenance switch, tax rates, delivery fees, which payment methods are on.
 *
 * The return value matters as much as the toast. Every settings page derives its
 * dirty flag from `settings !== savedSettings` and disables Save when clean, so a
 * page that adopts the rejected value into `savedSettings` greys out the one
 * control that would resend it. Callers must only update `savedSettings` when
 * this returns true.
 */
export function reportSettingsWrite(persisted: boolean, subject: string): boolean {
  if (persisted) {
    toast.success(`${subject} saved`);
    return true;
  }

  if (reportedAsSignedOut()) return false;

  // NOT "saved on this device only" — it is saved nowhere. The cache rollback
  // undoes the refused write and now announces it, so every other screen is
  // back on the value the server actually holds. What survives is the form in
  // front of the admin, which is exactly what they need in order to retry.
  toast.error(`${subject} not saved — the server rejected it`, {
    description: "Your changes are still in this form. Try again, or reload to discard them.",
  });
  return false;
}

/** As [reportSettingsWrite], for the "reset to defaults" action. */
export function reportSettingsReset(persisted: boolean, subject: string): boolean {
  if (persisted) {
    toast.success(`${subject} reset to defaults`);
    return true;
  }

  if (reportedAsSignedOut()) return false;

  toast.error(`${subject} reset on this device only — the server rejected it`, {
    description: "The saved settings are unchanged. Try again, or reload.",
  });
  return false;
}
