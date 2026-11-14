"use client";

import { useSyncExternalStore } from "react";

const neverChanges = () => () => {};

/**
 * True in the browser once the page has hydrated; false on the server and in
 * the hydrating render, so markup that depends on the browser (storage, the
 * clock, the platform) matches the server's on that first pass.
 *
 * This replaces `const [mounted, setMounted] = useState(false)` plus an
 * effect that set it — a second render React has to be told to do. Here the
 * hydrating render reads the server answer and React itself moves on to the
 * browser one; a component mounted later, after a client-side navigation,
 * reads `true` straight away because there is nothing to hydrate.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  );
}
