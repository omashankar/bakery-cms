import { toast } from "sonner";

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

  toast.error(`${subject} saved on this device only — the server rejected it`, {
    description: "Your changes are still here. Try again, or reload to discard them.",
  });
  return false;
}

/** As [reportSettingsWrite], for the "reset to defaults" action. */
export function reportSettingsReset(persisted: boolean, subject: string): boolean {
  if (persisted) {
    toast.success(`${subject} reset to defaults`);
    return true;
  }

  toast.error(`${subject} reset on this device only — the server rejected it`, {
    description: "The saved settings are unchanged. Try again, or reload.",
  });
  return false;
}
