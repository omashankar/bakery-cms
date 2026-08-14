import type { HydrationGate } from "@/lib/hydration-gate";
import type { ContentRead } from "./content-api";
import { settleFromRead } from "./content-api";

/**
 * The shared machinery behind banners, testimonials and FAQ.
 *
 * All three are replace-all collections with identical needs, and all three had
 * hand-written copies of the same three defects. This codebase's most reliable
 * bug is a fix landing in one twin and not its sibling — three separate repairs
 * here would have been three chances to produce exactly that — so the rule
 * lives once and each repository wires its own storage key, gates and fetcher
 * into it.
 *
 * `coupons-repository.ts` is the reference implementation these were measured
 * against; it already had all three.
 */

/**
 * Load the server's copy on demand, and say whether it may be written from.
 *
 * `ContentServerSync` runs from `app-providers` — which wraps /login — so an
 * admin who signs in through the form hydrates while ANONYMOUS and receives
 * only the rows a visitor may see. Signing in is a soft navigation, so that
 * `[]`-dep effect never runs again and the subset stands for the whole session.
 * This is the opener that fixes it, the same one `ensureSettingsHydrated` and
 * `ensureSeoHydrated` exist to provide for their own stores.
 */
export async function ensureWritable<T>(opts: {
  writable: HydrationGate;
  loaded: HydrationGate;
  fetch: () => Promise<ContentRead<T[]> | null>;
  persistServer: (items: T[]) => void;
}): Promise<boolean> {
  if (opts.writable.hasSettled()) return true;

  const read = await opts.fetch();
  const items = settleFromRead(read, { loaded: opts.loaded, writable: opts.writable });
  if (items) opts.persistServer(items);

  return opts.writable.hasSettled();
}

/**
 * The list a replace-all may be composed from, or null.
 *
 * THE GATE HAS TO GUARD THE READ. Guarding only the write is too late: by then
 * the payload has already been built from whatever this browser happened to
 * hold — the shipped demo seed on a cold device, or a visitor's filtered subset
 * on the admin's own machine — and the write either sends that or is refused,
 * with the poisoned list left in the cache either way.
 *
 * Null means the caller must send nothing at all and report that nothing was
 * saved. That is the honest answer, and it is what `readHydratedCoupons`
 * already does.
 */
export async function readWritableList<T>(opts: {
  writable: HydrationGate;
  loaded: HydrationGate;
  fetch: () => Promise<ContentRead<T[]> | null>;
  persistServer: (items: T[]) => void;
  loadLocal: () => T[];
}): Promise<T[] | null> {
  if (!(await ensureWritable(opts))) return null;
  return opts.loadLocal();
}

/**
 * Write locally, ask the server, and undo the local write if it says no.
 *
 * Without the rollback a refused edit stays in the cache — and because every
 * write here sends the WHOLE list, the next save from that tab, about an
 * entirely different row, carries the never-accepted change to the server. A
 * banner the admin was told had not saved goes live because they later edited a
 * different one.
 *
 * Only if the cache still holds this write: restoring the snapshot
 * unconditionally would undo a concurrent save the server HAD accepted, which
 * is worse than the poisoned cache this exists to prevent.
 */
export async function saveWithRollback<T>(opts: {
  storageKey: string;
  next: T[];
  writeLocal: (items: T[]) => void;
  request: (items: T[]) => Promise<boolean>;
  /** Re-notify readers after a rollback, if this collection has an event. */
  announce?: () => void;
}): Promise<boolean> {
  const previous =
    typeof window === "undefined" ? null : localStorage.getItem(opts.storageKey);

  opts.writeLocal(opts.next);
  const accepted = await opts.request(opts.next);

  if (!accepted && typeof window !== "undefined") {
    const stillOurs = localStorage.getItem(opts.storageKey) === JSON.stringify(opts.next);
    if (stillOurs) {
      if (previous === null) localStorage.removeItem(opts.storageKey);
      else localStorage.setItem(opts.storageKey, previous);
      opts.announce?.();
    }
  }

  return accepted;
}
