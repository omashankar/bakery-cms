"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { settingsHydration } from "./settings-api";
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
  const [form, setForm] = useState<{ current: T; saved: T }>({
    current: fallback,
    saved: fallback,
  });
  const [hydration, setHydration] = useState<SectionHydration>(
    // Already open from an earlier page in this session — no need to make the
    // admin wait again on a client-side navigation between settings pages.
    settingsHydration.hasSettled() ? "ready" : "pending",
  );

  // Written only from event handlers and effects, never during render. The ref
  // is what the listener reads synchronously; the state is what renders.
  const writingRef = useRef(false);
  const [isWriting, setIsWriting] = useState(false);
  const readRef = useRef(read);
  useEffect(() => {
    readRef.current = read;
  });

  useEffect(() => {
    let cancelled = false;

    function load() {
      // A write dispatches the update event before its server round-trip
      // finishes; adopting the in-flight value as `saved` is bug 2 above.
      if (writingRef.current) return;
      const loaded = readRef.current();
      setForm((prev) =>
        JSON.stringify(prev.current) !== JSON.stringify(prev.saved)
          ? prev
          : { current: loaded, saved: loaded },
      );
    }

    load();
    window.addEventListener(SETTINGS_UPDATED_EVENT, load);

    // Open the gate rather than wait on someone else to. Waiting was the bug:
    // the only opener was a root-layout effect that never re-ran after an
    // in-app login, so the gate stayed shut for the whole session.
    void ensureSettingsHydrated().then((settled) => {
      if (cancelled) return;
      // The values that arrived with hydration have to be adopted before the
      // form unlocks, or the admin edits on top of the seed again.
      if (settled) load();
      setHydration(settled ? "ready" : "unavailable");
    });

    return () => {
      cancelled = true;
      window.removeEventListener(SETTINGS_UPDATED_EVENT, load);
    };
  }, []);

  const isDirty = JSON.stringify(form.current) !== JSON.stringify(form.saved);

  const edit = useCallback((update: (prev: T) => T) => {
    setForm((prev) => ({ ...prev, current: update(prev.current) }));
  }, []);

  const discard = useCallback(() => {
    setForm((prev) => ({ ...prev, current: prev.saved }));
  }, []);

  const runWrite = useCallback(
    async (write: () => Promise<{ value: T; accepted: boolean }>) => {
      writingRef.current = true;
      setIsWriting(true);
      try {
        const { value, accepted } = await write();
        setForm((prev) => ({ current: value, saved: accepted ? value : prev.saved }));
      } finally {
        writingRef.current = false;
        setIsWriting(false);
      }
    },
    [],
  );

  return {
    settings: form.current,
    saved: form.saved,
    isDirty,
    hydration,
    isWriting,
    // Not while a write is already in flight: the round-trip can take seconds
    // on a cold serverless read, and the button used to sit there enabled and
    // unlabelled, inviting a second click that races the first.
    canSave: hydration === "ready" && !isWriting,
    edit,
    discard,
    runWrite,
  };
}
