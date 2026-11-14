"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

type Subscribe = (onChange: () => void) => () => void;

/** `read`, answering with the previous object while the data is unchanged. */
function cachedReader<T>(read: () => T): () => T {
  const memo: { key: string | null; value: T | undefined } = { key: null, value: undefined };
  return () => {
    const value = read();
    const key = JSON.stringify(value) ?? "undefined";
    if (memo.key === key) return memo.value as T;
    memo.key = key;
    memo.value = value;
    return value;
  };
}

/**
 * A subscription to window events — the custom "…-updated" events the
 * browser-side stores dispatch, plus "storage" when another tab writes.
 *
 * Create it once, at module level or in a `useMemo`: a new function on every
 * render would have React unsubscribe and subscribe again each time.
 */
export function windowEvents(...names: string[]): Subscribe {
  return (onChange) => {
    for (const name of names) window.addEventListener(name, onChange);
    return () => {
      for (const name of names) window.removeEventListener(name, onChange);
    };
  };
}

/**
 * What a browser-side store holds, read through React's own store hook.
 *
 * This replaces the pattern `useState(empty)` + an effect that called
 * `setX(load())` and then listened for the store's event: a render with the
 * empty value, a second render React was told to do, and the reading spread
 * over two places. Here the server and the hydrating render get `serverValue`
 * (so the markup matches), and React reads the store itself after that and
 * again whenever `subscribe` reports a change.
 *
 * The stores parse localStorage, so every read is a NEW object even when
 * nothing changed — and React would take that as a change on every render.
 * So a read that serialises the same as the last one hands back the last one.
 *
 * `read` should be stable (a module function, or memoised on what it reads).
 * Only the first `serverValue` is used.
 */
export function useExternalValue<T>(read: () => T, subscribe: Subscribe, serverValue: T): T {
  const getSnapshot = useMemo(() => cachedReader(read), [read]);
  const [server] = useState(() => serverValue);
  return useSyncExternalStore(subscribe, getSnapshot, () => server);
}
