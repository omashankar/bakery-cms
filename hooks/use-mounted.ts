"use client";

import { useHydrated } from "./use-hydrated";

/** Kept for its callers: the same answer as `useHydrated` (see there). */
export function useMounted(): boolean {
  return useHydrated();
}
