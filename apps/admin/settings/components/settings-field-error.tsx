"use client";

import { AlertTriangle } from "lucide-react";

import type { SectionHydration } from "@/features/settings/lib/use-settings-section";

/**
 * A validation message tied to the input it belongs to.
 *
 * `id` is not optional on purpose: the field must point at this with
 * `aria-describedby`, or a screen-reader user hears "invalid" and is told
 * nothing about why. `role="alert"` is what announces it when it appears — the
 * message is rendered in response to typing, so nothing else would.
 */
export function FieldError({ id, message }: { id: string; message: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

/**
 * Shown when the server's settings could not be read.
 *
 * The fields below it are the local seed, not the shop's real settings, and a
 * section PUT is a replace-all — so saving would overwrite the real ones with
 * demo data. Saving is blocked until a reload succeeds; showing the values
 * read-only is more useful than an empty page, as long as it says so.
 */
/**
 * Holds a settings form closed until the server's copy has landed.
 *
 * Gating only the SAVE button is not enough, and the gap is the whole bug.
 * `SettingsServerSync` reads the server copy from a root-layout effect, so on a
 * hard load that read is still in flight while the fields are already
 * interactive — and the local store answers with the demo seed meanwhile. The
 * admin types one character, the form is now dirty, the "never clobber unsaved
 * edits" rule makes the arriving server values get SKIPPED, and hydration then
 * settles and unlocks Save over a form that is the seed. The gate cannot help:
 * it is open by then.
 *
 * So the fields do not exist until there is something real to put in them. When
 * hydration never lands they appear anyway, showing the seed, with saving
 * blocked and `SettingsHydrationNotice` above them saying why — a screen that
 * shows defaults and refuses to save them is correct; one that offers to save
 * them is not.
 *
 * `SettingsSectionShell` does this for the sections that use it. Screens built
 * on `AdminPage` need it too, which is what this is for.
 */
export function SettingsFormGate({
  hydration,
  children,
}: {
  hydration: SectionHydration;
  children: React.ReactNode;
}) {
  if (hydration === "pending") {
    return <div className="min-h-48 animate-pulse rounded-xl border border-border bg-muted" />;
  }
  return <>{children}</>;
}

export function SettingsHydrationNotice({ hydration }: { hydration: SectionHydration }) {
  if (hydration !== "unavailable") return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-1 text-sm">
        <p className="font-medium">Showing defaults — the saved settings could not be loaded.</p>
        <p className="text-xs">
          Saving now would replace this section on the server with these placeholder values.
          Reload the page once the connection is back.
        </p>
      </div>
    </div>
  );
}
