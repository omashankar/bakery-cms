"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { cn } from "@/lib/utils";

interface MobileDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  /**
   * The width from which the page shows its own side panel instead — the
   * drawer is hidden there. `2xl` for a page whose panel only fits on a wide
   * screen (the media grid was squeezed to 90px cards at 1280).
   */
  from?: "xl" | "2xl";
}

const DESKTOP_MQ = { xl: "(min-width: 1280px)", "2xl": "(min-width: 1536px)" } as const;

export function MobileDetailDrawer({
  open,
  onClose,
  title,
  children,
  className,
  from = "xl",
}: MobileDetailDrawerProps) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_MQ[from]);
    function sync() {
      setIsDesktop(media.matches);
    }
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [from]);

  const drawerActive = open && !isDesktop;
  useBodyScrollLock(drawerActive);

  useEffect(() => {
    if (!drawerActive) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerActive, onClose]);

  if (!drawerActive) return null;

  return (
    <div className={cn("fixed inset-0 z-50", from === "2xl" ? "2xl:hidden" : "xl:hidden")}>
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close details"
      />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl border border-border bg-card shadow-sm",
          className
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-medium">{title ?? "Details"}</p>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
