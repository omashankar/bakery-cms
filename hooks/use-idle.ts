"use client";

import { useEffect, useState } from "react";

/**
 * True once the browser has nothing better to do — or once `timeoutMs` has
 * passed, whichever comes first.
 *
 * This exists so background cache hydration can be mounted a beat AFTER the
 * page the visitor actually asked for. Both trees that do such hydration use it:
 * the admin layout, whose fifteen sync hooks used to fire on mount, and the root
 * providers, whose sync components did the same on every storefront page.
 *
 * The ceiling matters as much as the idle callback. `requestIdleCallback` can
 * wait indefinitely on a busy main thread, and these caches must not be starved
 * for the whole session — so the timeout is what actually bounds the wait, and
 * the idle callback only decides how much sooner than that it happens.
 */
export function useIdle(timeoutMs: number): boolean {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    // Safari has no requestIdleCallback; a plain timer makes the same promise,
    // minus the "and the main thread is free" part.
    if (typeof window.requestIdleCallback !== "function") {
      const timer = setTimeout(() => setIdle(true), timeoutMs);
      return () => clearTimeout(timer);
    }

    const handle = window.requestIdleCallback(() => setIdle(true), { timeout: timeoutMs });
    return () => window.cancelIdleCallback(handle);
  }, [timeoutMs]);

  return idle;
}
