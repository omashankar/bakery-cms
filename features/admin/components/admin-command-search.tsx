"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Cake,
  Clock3,
  FileText,
  FolderOpen,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Package,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Tag,
  Users,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clearRecentSearches,
  loadRecentSearches,
  recentSearchToResult,
  recordRecentSearch,
} from "@/features/admin/lib/global-search-history";
import {
  getGlobalSearchGroupHints,
  getGlobalSearchGroupLabel,
  getGlobalSearchShortcuts,
  groupGlobalSearchResults,
  parseGlobalSearchQuery,
  searchAdminGlobal,
  type GlobalSearchGroup,
  type GlobalSearchResult,
} from "@/features/admin/lib/global-search";
import { cn } from "@/lib/utils";

const GROUP_ICONS: Record<GlobalSearchGroup, typeof Search> = {
  products: Cake,
  orders: ShoppingBag,
  customers: Users,
  coupons: Tag,
  pages: FileText,
  media: FolderOpen,
  inquiries: MessageSquare,
  inventory: Package,
  delivery: MapPin,
  settings: Settings,
  navigation: LayoutDashboard,
  actions: Zap,
};

const GROUP_FILTERS: Array<GlobalSearchGroup | "all"> = [
  "all",
  "products",
  "orders",
  "customers",
  "inquiries",
  "inventory",
  "delivery",
  "coupons",
  "pages",
  "media",
  "settings",
  "navigation",
  "actions",
];

interface AdminCommandSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ResultButton({
  result,
  active,
  onSelect,
}: {
  result: GlobalSearchResult;
  active: boolean;
  onSelect: (result: GlobalSearchResult) => void;
}) {
  const Icon = GROUP_ICONS[result.group];

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "hover:bg-muted"
      )}
      onClick={() => onSelect(result)}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          active ? "text-current" : "text-muted-foreground"
        )}
        strokeWidth={1.75}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{result.title}</span>
          {result.badge ? (
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 text-[10px]",
                active && "border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground"
              )}
            >
              {result.badge}
            </Badge>
          ) : null}
        </span>
        {result.subtitle ? (
          <span
            className={cn(
              "block truncate text-xs",
              active ? "text-primary-foreground/80" : "text-muted-foreground"
            )}
          >
            {result.subtitle}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function AdminCommandSearch({ open, onOpenChange }: AdminCommandSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [groupFilter, setGroupFilter] = useState<GlobalSearchGroup | "all">("all");
  const [recentVersion, setRecentVersion] = useState(0);

  const parsedQuery = useMemo(() => parseGlobalSearchQuery(query), [query]);
  const effectiveGroupFilter =
    parsedQuery.groupFilter !== "all" ? parsedQuery.groupFilter : groupFilter;

  const results = useMemo(
    () => searchAdminGlobal(query, { groupFilter: effectiveGroupFilter }),
    [query, effectiveGroupFilter]
  );

  const shortcuts = useMemo(() => getGlobalSearchShortcuts(), []);
  const recentResults = useMemo(
    () => loadRecentSearches().map(recentSearchToResult),
    [recentVersion, open]
  );

  const emptyStateResults = useMemo(() => {
    if (recentResults.length > 0) return recentResults;
    return shortcuts;
  }, [recentResults, shortcuts]);

  const grouped = useMemo(() => groupGlobalSearchResults(results), [results]);
  const flatResults = useMemo(
    () => (query.trim() ? grouped.flatMap((section) => section.items) : emptyStateResults),
    [grouped, emptyStateResults, query]
  );

  const handleSelect = useCallback(
    (result: GlobalSearchResult) => {
      recordRecentSearch(result);
      setRecentVersion((value) => value + 1);
      onOpenChange(false);
      setQuery("");
      setGroupFilter("all");
      router.push(result.href);
    },
    [onOpenChange, router]
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      setGroupFilter("all");
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, groupFilter]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange]);

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, Math.max(flatResults.length - 1, 0)));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    }
    if (event.key === "Enter" && flatResults[activeIndex]) {
      event.preventDefault();
      handleSelect(flatResults[activeIndex]);
    }
  }

  const showingSearchResults = query.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl" showCloseButton>
        <DialogHeader className="border-b border-border px-4 py-3 text-left">
          <DialogTitle className="sr-only">Global search</DialogTitle>
          <DialogDescription className="sr-only">
            Search products, orders, customers, inquiries, inventory, delivery zones, pages, media,
            settings, and admin navigation.
          </DialogDescription>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search or type order:, product:, inquiry:, stock:, zone:, >action…"
              className="h-10 border-border bg-muted/50 pl-9 shadow-none"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2">
            {GROUP_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setGroupFilter(filter)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  effectiveGroupFilter === filter
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                {filter === "all" ? "All" : getGlobalSearchGroupLabel(filter)}
              </button>
            ))}
          </div>
        </DialogHeader>

        <div className="max-h-[min(60vh,460px)] overflow-y-auto p-2">
          {showingSearchResults && flatResults.length === 0 ? (
            <div className="px-3 py-10 text-center">
              <Search className="mx-auto size-8 text-muted-foreground" strokeWidth={1.5} />
              <p className="mt-3 text-sm text-muted-foreground">
                No results for &ldquo;{query}&rdquo;
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {getGlobalSearchGroupHints().map((hint) => (
                  <button
                    key={hint.prefix}
                    type="button"
                    className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => setQuery(hint.prefix)}
                  >
                    <span className="font-mono">{hint.prefix}</span> {hint.label}
                  </button>
                ))}
              </div>
            </div>
          ) : showingSearchResults ? (
            <>
              <p className="px-3 py-1 text-xs text-muted-foreground">
                {flatResults.length} result{flatResults.length === 1 ? "" : "s"}
                {parsedQuery.groupFilter !== "all"
                  ? ` in ${getGlobalSearchGroupLabel(parsedQuery.groupFilter)}`
                  : ""}
              </p>
              {grouped.map((section) => (
                <div key={section.group} className="mb-2 last:mb-0">
                  <p className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    {section.label}
                  </p>
                  <div className="space-y-0.5">
                    {section.items.map((result) => {
                      const index = flatResults.findIndex((item) => item.id === result.id);
                      return (
                        <ResultButton
                          key={result.id}
                          result={result}
                          active={index === activeIndex}
                          onSelect={handleSelect}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              {recentResults.length > 0 ? (
                <div className="mb-3">
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                      <Clock3 className="size-3.5" />
                      Recent
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => {
                        clearRecentSearches();
                        setRecentVersion((value) => value + 1);
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="space-y-0.5">
                    {recentResults.map((result, index) => (
                      <ResultButton
                        key={result.id}
                        result={result}
                        active={index === activeIndex}
                        onSelect={handleSelect}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mb-2">
                <p className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  <Sparkles className="size-3.5" />
                  Quick access
                </p>
                <div className="space-y-0.5">
                  {(recentResults.length > 0 ? shortcuts : emptyStateResults).map((result, index) => {
                    const offset = recentResults.length > 0 ? recentResults.length : 0;
                    return (
                      <ResultButton
                        key={result.id}
                        result={result}
                        active={index + offset === activeIndex}
                        onSelect={handleSelect}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-border bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Search tips</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {getGlobalSearchGroupHints().map((hint) => (
                    <button
                      key={hint.prefix}
                      type="button"
                      className="rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[10px] hover:text-foreground"
                      onClick={() => setQuery(hint.prefix)}
                    >
                      {hint.prefix}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">
                ↑
              </kbd>{" "}
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">
                ↓
              </kbd>{" "}
              navigate
            </span>
            <span>
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">
                Enter
              </kbd>{" "}
              open
            </span>
          </div>
          <span className="inline-flex items-center gap-1">
            <Bell className="size-3" />
            Commerce + CMS modules
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
      <kbd className="ml-auto hidden rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground lg:inline">
        {shortcut}
      </kbd>
    </button>
  );
}
