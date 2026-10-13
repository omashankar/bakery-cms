"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The search box in the header, and the ⌘K / Ctrl K shortcut that opens it.
 *
 * Kept apart from the palette itself (`admin-command-search.tsx`) so the
 * header can load the palette lazily: the palette carries the whole global
 * search — products, orders, customers, media, inventory — and every admin
 * screen used to download and run it before showing its own content.
 */

interface AdminCommandSearchTriggerProps {
  onOpen: () => void;
  className?: string;
}

export function AdminCommandSearchTrigger({ onOpen, className }: AdminCommandSearchTriggerProps) {
  const [shortcut, setShortcut] = useState("Ctrl K");

  useEffect(() => {
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform) || navigator.userAgent.includes("Mac");
    setShortcut(isMac ? "⌘K" : "Ctrl K");
  }, []);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "relative flex h-8 w-full items-center rounded-md border border-sidebar-border bg-muted/40 pl-8 pr-3 text-left text-sm text-muted-foreground shadow-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:outline-none",
        className
      )}
    >
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
      <span className="truncate">Search admin…</span>
      <kbd className="ml-auto hidden rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground lg:inline">
        {shortcut}
      </kbd>
    </button>
  );
}

/** ⌘K / Ctrl K opens the palette from anywhere in the admin. */
export function useCommandSearchShortcut(onOpen: () => void): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpen();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpen]);
}
