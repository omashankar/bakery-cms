"use client";

import { useEffect } from "react";

/** Lock body scroll when overlays/drawers are open */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [locked]);
}
