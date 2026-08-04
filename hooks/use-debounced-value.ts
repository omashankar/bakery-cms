"use client";

import { useEffect, useState } from "react";

/**
 * `value`, but only after it has stopped changing for `delayMs`.
 *
 * For search boxes that drive a server request. The admin list endpoints filter
 * over the whole orders collection, so keying a fetch directly off the input
 * turns a six-letter name into six full-collection queries — five of which are
 * already stale by the time they land.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
