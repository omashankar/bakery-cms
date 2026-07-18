"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminShell } from "@/apps/admin/components/admin-shell";
import { cn } from "@/lib/utils";

interface FilterPanelProps {
  children: ReactNode;
  className?: string;
}

export function FilterPanel({ children, className }: FilterPanelProps) {
  return <section className={cn(adminShell.filterCard, className)}>{children}</section>;
}

interface FilterPanelToolbarProps {
  children: ReactNode;
  className?: string;
}

export function FilterPanelToolbar({ children, className }: FilterPanelToolbarProps) {
  return (
    <div className={cn("flex flex-col gap-3 lg:flex-row lg:items-center", className)}>
      {children}
    </div>
  );
}

interface FilterPanelSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Accessible name. Defaults to the placeholder, which a screen reader cannot rely on. */
  label?: string;
}

export function FilterPanelSearch({
  value,
  onChange,
  placeholder = "Search…",
  className,
  label,
}: FilterPanelSearchProps) {
  return (
    <div className={cn("relative min-w-0 flex-1", className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        className="pl-9"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label ?? placeholder}
      />
    </div>
  );
}

interface FilterPanelControlsProps {
  children: ReactNode;
  className?: string;
}

export function FilterPanelControls({ children, className }: FilterPanelControlsProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap", className)}>
      {children}
    </div>
  );
}

interface FilterPanelAdvancedProps {
  children: ReactNode;
  activeCount?: number;
  defaultOpen?: boolean;
  label?: string;
  className?: string;
}

export function FilterPanelAdvanced({
  children,
  activeCount = 0,
  defaultOpen = false,
  label = "Advanced filters",
  className,
}: FilterPanelAdvancedProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("border-t border-border pt-4", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-2 px-2 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <SlidersHorizontal className="size-3.5" />
        {label}
        {activeCount > 0 ? (
          <span className="rounded-full bg-bakery-100 px-1.5 py-0.5 text-[10px] font-semibold text-bakery-800">
            {activeCount}
          </span>
        ) : null}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </Button>
      {open ? <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div> : null}
    </div>
  );
}

interface FilterPanelActionsProps {
  children: ReactNode;
  className?: string;
}

export function FilterPanelActions({ children, className }: FilterPanelActionsProps) {
  return (
    <div className={cn("mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4", className)}>
      {children}
    </div>
  );
}
