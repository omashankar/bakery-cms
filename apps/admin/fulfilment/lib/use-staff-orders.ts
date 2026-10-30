"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A short list that keeps itself current — the kitchen tablet and the rider's
 * phone are left open for hours, and nobody presses "refresh" mid-shift.
 *
 * Re-read every minute, whenever the screen comes back into view, and on
 * demand. A failed refresh keeps what is on screen and says so, rather than
 * blanking a queue somebody is working from.
 */
const REFRESH_MS = 60_000;

export type ListState = "loading" | "ready" | "error";

export function useStaffOrders<T extends { id: string }>(
  load: () => Promise<T[] | null>,
  /** The list as the server rendered it, so the first paint is not a skeleton. */
  initial: T[] | null = null,
) {
  const [orders, setOrders] = useState<T[]>(initial ?? []);
  const [state, setState] = useState<ListState>(initial ? "ready" : "loading");
  const [stale, setStale] = useState(false);
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  const hasData = useRef(initial !== null);

  const refresh = useCallback(async () => {
    const next = await loadRef.current();
    if (next) {
      hasData.current = true;
      setOrders(next);
      setState("ready");
      setStale(false);
      setLastLoaded(new Date());
    } else if (hasData.current) {
      setStale(true);
    } else {
      setState("error");
    }
  }, []);

  useEffect(() => {
    // Already have the server's list? The next read is the timer's.
    if (!hasData.current) void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  /** Put the server's answer for one order in place, without waiting for the next read. */
  const replace = useCallback((order: T) => {
    setOrders((current) => current.map((o) => (o.id === order.id ? order : o)));
  }, []);

  return { orders, state, stale, lastLoaded, refresh, replace };
}
