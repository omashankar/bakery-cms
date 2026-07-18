"use client";

import { useMemo, useState } from "react";
import {
  Award,
  Camera,
  Cake,
  Gift,
  Heart,
  HelpCircle,
  Images,
  LayoutGrid,
  Leaf,
  Mail,
  Megaphone,
  Quote,
  Search,
  Shield,
  Sparkles,
  Sun,
  Tag,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const iconMap: Record<string, LucideIcon> = {
  Sparkles,
  LayoutGrid,
  Star: Award,
  TrendingUp,
  Award,
  Tag,
  Heart,
  Camera,
  Leaf,
  Sun,
  Shield,
  Quote,
  Images,
  HelpCircle,
  Mail,
  Megaphone,
  Gift,
  Cake,
};

export interface BuilderRegistryEntry {
  type: string;
  label: string;
  icon: string;
}

interface AddSectionDialogProps<T extends string> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (type: T) => void;
  registry: BuilderRegistryEntry[];
  title?: string;
  description?: string;
}

export function AddSectionDialog<T extends string>({
  open,
  onOpenChange,
  onAdd,
  registry,
  title = "Add section",
  description = "Choose a section type to append to the bottom of your page layout.",
}: AddSectionDialogProps<T>) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return registry;
    return registry.filter(
      (entry) =>
        entry.label.toLowerCase().includes(query) ||
        entry.type.toLowerCase().includes(query)
    );
  }, [registry, search]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSearch("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search sections…"
            aria-label="Search sections"
          />
        </div>

        <div className="panel-scroll grid max-h-[50vh] gap-2 overflow-y-auto sm:grid-cols-2">
          {filtered.length === 0 ? (
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
              No sections match “{search.trim()}”.
            </p>
          ) : (
            filtered.map((entry) => {
              const Icon = iconMap[entry.icon] ?? Sparkles;
              return (
                <button
                  key={entry.type}
                  type="button"
                  onClick={() => {
                    onAdd(entry.type as T);
                    setSearch("");
                    onOpenChange(false);
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-border px-3 py-3 text-left transition-colors",
                    "hover:border-primary/40 hover:bg-muted"
                  )}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
                    <Icon className="size-4" />
                  </div>
                  <p className="min-w-0 truncate text-sm font-medium">{entry.label}</p>
                </button>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setSearch("");
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
