"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { HydrationGate } from "@/lib/hydration-gate";

/**
 * Shared state for ANY admin form whose save is a replace-all.
 *
 * This is `useSettingsSection` with the store swapped out. That hook was written
 * for the settings sections and documents the defect in full; the same defect
 * turned out to live on nine other admin screens that write through their own
 * stores — SEO, header, footer, appearance, inventory, custom code, the admin
 * profile — so the logic now has one home instead of ten hand-rolled copies.
 *
 * The two bugs it exists to prevent, restated because every re-implementation
 * has reintroduced at least one of them:
 *
 * 1. THE FORM CAPTURES THE SEED, AND DIRTINESS THEN PROTECTS IT.
 *    A `*ServerSync` reads the server's copy into localStorage from a `[]`-dep
 *    effect near the root, so on a hard load that read is still in flight while
 *    the form is already interactive — and the local store answers with the DEMO
 *    SEED meanwhile. The admin types one character, the form is dirty, the
 *    "never clobber unsaved edits" rule makes the ARRIVING server values get
 *    skipped, and Save pushes the seed plus that one edit over real data.
 *
 *    Gating the Save BUTTON does not fix this: the gate is open by then. The
 *    caller must hold its fields closed while `hydration === "pending"`.
 *
 * 2. THE RESYNC RE-BASELINED `saved` MID-WRITE.
 *    A local write dispatches its updated-event synchronously, before the
 *    awaited server round-trip. So the listener fired while the save was still
 *    in flight and, on a pristine form, set `saved` to the value being written —
 *    and a REJECTED write then looked clean: Save greyed out, no retry, while
 *    the toast said the change was only on this device. `runWrite` suppresses
 *    the listener for the duration.
 */
export type FormHydration = "pending" | "ready" | "unavailable";

export interface HydratedForm<T> {
  /** The edited copy — what the inputs render. */
  value: T;
  /** The last copy the SERVER confirmed. */
  saved: T;
  isDirty: boolean;
  hydration: FormHydration;
  /** True while a save or reset is in flight — the button must say so. */
  isWriting: boolean;
  /** True once it is safe to let the admin save: hydrated, and not mid-write. */
  canSave: boolean;
  /** Apply an edit to the working copy. */
  edit: (update: (prev: T) => T) => void;
  /** Replace the working copy outright. */
  set: (next: T) => void;
  /** Revert the working copy to the last server-confirmed one. */
  discard: () => void;
  /**
   * Runs a save/reset with the resync listener suppressed, then commits the
   * result: `saved` moves only when the server accepted it.
   */
  runWrite: (write: () => Promise<{ value: T; accepted: boolean }>) => Promise<void>;
}

export interface HydratedFormOptions<T> {
  /** Reads the current value out of the local store. */
  read: () => T;
  /** What to show before anything has been read. */
  fallback: T;
  /** The gate for this store — already open means no wait. */
  gate: HydrationGate;
  /**
   * Reads the server's copy into the local store and opens the gate, returning
   * whether that succeeded.
   *
   * Called on mount rather than waiting for someone else's effect. Waiting was
   * the bug: an admin who signs in through the LOGIN FORM loads the layout while
   * anonymous, so its sync 401s and the gate stays shut — and reaching the admin
   * afterwards is a soft navigation that never remounts that layout. Without an
   * on-demand opener the gate stays shut for the whole session and every save
   * reports "saved on this device only".
   */
  ensureHydrated: () => Promise<boolean>;
  /**
   * The store's "something changed" event, so the form resyncs while pristine.
   *
   * Optional: the header and footer stores dispatch nothing, and for them the
   * re-read after `ensureHydrated` resolves is the only resync there is — which
   * is the one that matters, because it is the one that replaces the seed.
   */
  updatedEvent?: string;
}

export function useHydratedForm<T>({
  read,
  fallback,
  gate,
  ensureHydrated,
  updatedEvent,
}: HydratedFormOptions<T>): HydratedForm<T> {
  const [form, setForm] = useState<{ current: T; saved: T }>({
    current: fallback,
    saved: fallback,
  });
  const [hydration, setHydration] = useState<FormHydration>(
    // Already open from an earlier page in this session — no need to make the
    // admin wait again on a client-side navigation between admin screens.
    gate.hasSettled() ? "ready" : "pending",
  );

  // Written only from event handlers and effects, never during render. The ref
  // is what the listener reads synchronously; the state is what renders.
  const writingRef = useRef(false);
  const [isWriting, setIsWriting] = useState(false);
  const readRef = useRef(read);
  const ensureRef = useRef(ensureHydrated);
  useEffect(() => {
    readRef.current = read;
    ensureRef.current = ensureHydrated;
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
    if (updatedEvent) window.addEventListener(updatedEvent, load);

    void ensureRef.current().then((settled) => {
      if (cancelled) return;
      // The values that arrived with hydration have to be adopted before the
      // form unlocks, or the admin edits on top of the seed again.
      if (settled) load();
      setHydration(settled ? "ready" : "unavailable");
    });

    return () => {
      cancelled = true;
      if (updatedEvent) window.removeEventListener(updatedEvent, load);
    };
  }, [updatedEvent]);

  const isDirty = JSON.stringify(form.current) !== JSON.stringify(form.saved);

  const edit = useCallback((update: (prev: T) => T) => {
    setForm((prev) => ({ ...prev, current: update(prev.current) }));
  }, []);

  const set = useCallback((next: T) => {
    setForm((prev) => ({ ...prev, current: next }));
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
    value: form.current,
    saved: form.saved,
    isDirty,
    hydration,
    isWriting,
    // Not while a write is already in flight: the round-trip can take seconds on
    // a cold serverless read, and the button used to sit there enabled and
    // unlabelled, inviting a second click that races the first.
    canSave: hydration === "ready" && !isWriting,
    edit,
    set,
    discard,
    runWrite,
  };
}
