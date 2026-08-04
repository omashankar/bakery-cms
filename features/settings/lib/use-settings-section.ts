"use client";


import { settingsHydration } from "./settings-api";
import { useHydratedForm } from "./use-hydrated-form";
import { ensureSettingsHydrated, SETTINGS_UPDATED_EVENT } from "./settings-repository";

/**
 * Shared state for one section of the admin settings form.
 *
 * This exists because the obvious way to write these pages has two bugs, and all
 * three pages that hand-rolled it had both.
 *
 * 1. THE FORM CAPTURES THE SEED, AND DIRTINESS THEN PROTECTS IT.
 *    `SettingsServerSync` reads the server copy into localStorage from a
 *    `[]`-dep effect in the ROOT layout, so on a hard load of a settings page
 *    that read is still in flight while the form is already interactive — and
 *    `loadSettings()` answers with `defaultAppSettings` in the meantime. The
 *    admin types one character, the form is now dirty, the "never clobber
 *    unsaved edits" rule makes the arriving server values get skipped, and Save
 *    PUTs the demo seed plus that one edit over the shop's real settings. A
 *    section PUT is a replace-all, so the address, phone, map and hours all go.
 *    The hydration gate cannot help: it is open by then.
 *
 *    So the form is not editable until hydration has actually landed. When it
 *    never lands, the fields stay visible but `canSave` is false — a settings
 *    page that shows the seed and refuses to save it is correct; one that offers
 *    to save it is not.
 *
 * 2. THE RESYNC RE-BASELINED `saved` MID-WRITE.
 *    `updateStore` calls `saveSettings()`, whose `persist()` dispatches
 *    SETTINGS_UPDATED_EVENT *synchronously*, before the awaited `pushSection`.
 *    So the listener fired while a save or reset was still in flight and, on a
 *    pristine form, set `saved` to the value being written. The caller's own
 *    `saved: accepted ? value : prev.saved` guard then read an already-poisoned
 *    `prev.saved`, and a REJECTED write ended up looking clean: Save greyed out,
 *    no retry, while the toast claimed "your changes are still here".
 *
 *    `runWrite` suppresses the listener for the duration of the write.
 */
export type SectionHydration = "pending" | "ready" | "unavailable";

export interface SectionForm<T> {
  /** The edited copy — what the inputs render. */
  settings: T;
  /** The last copy the SERVER confirmed. */
  saved: T;
  isDirty: boolean;
  hydration: SectionHydration;
  /** True while a save or reset is in flight — the button must say so. */
  isWriting: boolean;
  /** True once it is safe to let the admin save: hydrated, and not mid-write. */
  canSave: boolean;
  /** Apply an edit to the working copy. */
  edit: (update: (prev: T) => T) => void;
  /** Revert the working copy to the last server-confirmed one. */
  discard: () => void;
  /**
   * Runs a save/reset with the resync listener suppressed, then commits the
   * result: `saved` moves only when the server accepted it.
   */
  runWrite: (write: () => Promise<{ value: T; accepted: boolean }>) => Promise<void>;
}

export function useSettingsSection<T>(read: () => T, fallback: T): SectionForm<T> {
  // The shared implementation, with the settings store wired in. The logic
  // lived here first and then had to be repeated on every other admin form
  // that writes a replace-all — SEO, header, footer, appearance, inventory,
  // custom code, the admin profile — so it moved to `useHydratedForm` and this
  // is now the settings-shaped view of it. One implementation is the point:
  // every hand-rolled copy reintroduced at least one of the two bugs above.
  const form = useHydratedForm<T>({
    read,
    fallback,
    gate: settingsHydration,
    ensureHydrated: ensureSettingsHydrated,
    updatedEvent: SETTINGS_UPDATED_EVENT,
  });

  return {
    settings: form.value,
    saved: form.saved,
    isDirty: form.isDirty,
    hydration: form.hydration,
    isWriting: form.isWriting,
    canSave: form.canSave,
    edit: form.edit,
    discard: form.discard,
    runWrite: form.runWrite,
  };
}
