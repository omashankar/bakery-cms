"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Lets a Base UI dropdown open on hover (it only supports click natively).
 * A small close delay bridges the gap between the trigger and the popup so the
 * menu stays open while the pointer travels between them.
 */
export function useHoverMenu(closeDelay = 150) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  }, []);

  const scheduleClose = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), closeDelay);
  }, [closeDelay]);

  const hoverProps = { onMouseEnter: openNow, onMouseLeave: scheduleClose };

  return { open, setOpen, hoverProps };
}
