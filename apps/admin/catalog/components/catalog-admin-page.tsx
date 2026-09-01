"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Tags,
  Trash2,
} from "lucide-react";
import { reportWrite } from "@/apps/admin/lib/report-write";
import {
  FilterPanel,
  FilterPanelSearch,
} from "@/apps/admin/components/filter-panel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/shared/empty-state";
import { AdminPage, AdminPageHeader, adminShell } from "@/apps/admin/components";
import type { CatalogStore, CatalogTab } from "@/types/catalog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
// The shop's own currency. The weight modifier printed a hardcoded ₹ while
// every other price on the screen already resolved `general.currency`.
import { formatCurrency } from "@/utils/format";
import {
  CATALOG_UPDATED_EVENT,
  deleteCategories,
  deleteFlavours,
  deleteOccasions,
  deleteWeightOptions,
  loadCatalogStore,
  resetCatalogStore,
} from "@/features/catalog/lib/catalog-repository";
import {
  CATALOG_HYDRATION_EVENT,
  catalogHydrationStatus,
} from "@/features/catalog/lib/catalog-api";
import { loadProducts } from "@/features/products/lib/products-repository";
import type { ModuleSettings } from "@/types/settings";
import { defaultModuleSettings } from "@/features/settings/lib/settings-utils";
import {
  getModuleSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";
import { CatalogFormDialog } from "./catalog-form-dialog";

const EMPTY_STORE: CatalogStore = {
  categories: [],
  flavours: [],
  occasions: [],
  weights: [],
  updatedAt: "",
};

const tabs: Array<{
  id: CatalogTab;
  label: string;
  singular: string;
}> = [
  { id: "categories", label: "Categories", singular: "Category" },
  { id: "occasions", label: "Occasions", singular: "Occasion" },
  { id: "flavours", label: "Flavours", singular: "Flavour" },
  { id: "weights", label: "Weights", singular: "Weight" },
];

// Tab bar order — includes a Themes placeholder (design-theme data model comes later).
const tabBar: Array<{ id: CatalogTab | "themes"; label: string; soon?: boolean }> = [
  { id: "categories", label: "Categories" },
  { id: "occasions", label: "Occasions" },
  { id: "themes", label: "Themes", soon: true },
  { id: "flavours", label: "Flavours" },
  { id: "weights", label: "Weights" },
];

export function CatalogAdminPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<CatalogTab>("categories");
  const [modules, setModules] = useState<ModuleSettings>(defaultModuleSettings);
  const [showThemes, setShowThemes] = useState(false);
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hydration, setHydration] = useState<"pending" | "ready" | "unavailable">("pending");

  /**
   * Every section here is a replace-all, so nothing may be published until the
   * server's taxonomy has arrived. The buttons are disabled rather than left
   * live with a guard inside the handler — a button that looks available and
   * does nothing is the same lie in a different place.
   */
  const canWrite = hydration === "ready";

  const store = useMemo(
    () => (mounted ? loadCatalogStore() : EMPTY_STORE),
    [mounted, refreshKey]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // The taxonomy arrives from the server AFTER this screen has already read
  // localStorage. Without these listeners the page rendered whatever the cache
  // held at mount for the whole visit — the shipped defaults on a fresh
  // browser — and selecting a row from that list addressed an id the server had
  // never heard of.
  useEffect(() => {
    const sync = () => {
      setHydration(catalogHydrationStatus());
      setRefreshKey((value) => value + 1);
      setSelectedIds([]);
    };
    sync();
    window.addEventListener(CATALOG_UPDATED_EVENT, sync);
    window.addEventListener(CATALOG_HYDRATION_EVENT, sync);
    return () => {
      window.removeEventListener(CATALOG_UPDATED_EVENT, sync);
      window.removeEventListener(CATALOG_HYDRATION_EVENT, sync);
    };
  }, []);

  // Flavours/Weights are optional bakery modules — hide those tabs when off.
  useEffect(() => {
    const sync = () => {
      const next = getModuleSettings();
      setModules(next);
      setActiveTab((current) => {
        if (current === "flavours" && !next.flavour) return "categories";
        if (current === "weights" && !next.weight) return "categories";
        return current;
      });
    };
    sync();
    window.addEventListener(SETTINGS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, sync);
  }, []);

  const moduleForTab: Partial<Record<CatalogTab | "themes", keyof ModuleSettings>> = {
    flavours: "flavour",
    weights: "weight",
  };
  const visibleTabBar = tabBar.filter((tab) => {
    const mod = moduleForTab[tab.id];
    return mod ? modules[mod] : true;
  });

  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list =
      activeTab === "categories"
        ? store.categories
        : activeTab === "flavours"
          ? store.flavours
          : activeTab === "occasions"
            ? store.occasions
            : store.weights;

    if (!query) return list;
    return list.filter((item) => {
      const label = "label" in item ? item.label : item.name;
      const slug = "slug" in item ? item.slug : "";
      return label.toLowerCase().includes(query) || slug.toLowerCase().includes(query);
    });
  }, [activeTab, search, store]);

  // How many published products are really in each category. `cakeCount` on the
  // category is a hand-typed number that agreed with nothing: the seed claimed
  // 48 cakes under Birthday and 271 across all categories, in a shop with 25.
  const productsByCategory = useMemo(() => {
    if (!mounted) return new Map<string, number>();
    const tally = new Map<string, number>();
    for (const cake of loadProducts()) {
      if (cake.status !== "published") continue;
      tally.set(cake.categoryId, (tally.get(cake.categoryId) ?? 0) + 1);
    }
    return tally;
  }, [mounted, refreshKey]);

  const counts = {
    categories: store.categories.length,
    flavours: store.flavours.length,
    occasions: store.occasions.length,
    weights: store.weights.length,
  };

  const totalItems =
    counts.categories + counts.flavours + counts.occasions + counts.weights;
  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const allSelected =
    items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  function refresh() {
    setRefreshKey((value) => value + 1);
    setSelectedIds([]);
  }

  function switchTab(tab: CatalogTab) {
    setShowThemes(false);
    setActiveTab(tab);
    setSearch("");
    setSelectedIds([]);
  }

  function openCreate() {
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setFormOpen(true);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(items.map((item) => item.id));
  }

  /** Products that would be orphaned by deleting the current selection. */
  function orphanCount(): number {
    if (activeTab !== "categories") return 0;
    return selectedIds.reduce((n, id) => n + (productsByCategory.get(id) ?? 0), 0);
  }

  async function handleDelete() {
    if (selectedIds.length === 0) return;

    // Nothing reassigns or blocks a product whose category is deleted. It keeps
    // pointing at an id nothing resolves, so the storefront labels it the
    // generic "Cakes" and the admin category filter can never find it again.
    // Three of this shop's products are already in that state.
    const orphans = orphanCount();
    if (orphans > 0) {
      const noun = orphans === 1 ? "product is" : "products are";
      const which = selectedIds.length === 1 ? "category" : "categories";
      const ok = window.confirm(
        `${orphans} published ${noun} still in the ${which} you are deleting.\n\n` +
          "They will keep pointing at a category that no longer exists: the shop " +
          "will show them as uncategorised, and the category filter here will " +
          "never find them again.\n\nDelete anyway?"
      );
      if (!ok) return;
    }
    const remove =
      activeTab === "categories"
        ? deleteCategories
        : activeTab === "flavours"
          ? deleteFlavours
          : activeTab === "occasions"
            ? deleteOccasions
            : deleteWeightOptions;

    const { value: count, persisted } = await remove(selectedIds);
    refresh();
    reportWrite(persisted, `Deleted ${count} item${count === 1 ? "" : "s"}`);
  }

  async function handleReset() {
    // One click on "Reset defaults" replaced all four taxonomies in the database
    // with the shipped ones, unconfirmed. Everything a shop had named — its
    // categories, occasions, flavours and weight tiers — gone, and every product
    // left pointing at ids that no longer existed.
    const ok = window.confirm(
      `This replaces all four lists — ${counts.categories} categories, ` +
        `${counts.occasions} occasions, ${counts.flavours} flavours and ` +
        `${counts.weights} weights — with the ones this software ships with.\n\n` +
        "Anything you have named here is lost, and products using those values will " +
        "point at entries that no longer exist.\n\nReset the whole catalog?"
    );
    if (!ok) return;

    // Server first: it owns the defaults and records the reset in the audit log.
    // The cache follows only what it accepted, so a refused reset leaves this
    // browser holding the taxonomy that is really in place.
    const { persisted } = await resetCatalogStore();
    refresh();
    reportWrite(persisted, "Catalog reset to defaults");
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Catalog"
        description={
          showThemes
            ? "Design themes — coming soon"
            : totalItems > 0
              ? `${counts[activeTab]} ${activeTabMeta.label.toLowerCase()} · ${totalItems} total`
              : "Categories, flavours, occasions, and weights"
        }
        className="gap-3"
        actions={
          <div className="flex w-full gap-2">
            <Button
              variant="outline"
              className="min-w-0 flex-1 sm:flex-none"
              disabled={!canWrite}
              onClick={handleReset}
            >
              <RotateCcw className="size-4" />
              <span className="sm:hidden">Reset</span>
              <span className="hidden sm:inline">Reset defaults</span>
            </Button>
            {!showThemes ? (
              <Button
                variant="bakery"
                className="min-w-0 flex-1 sm:flex-none"
                disabled={!canWrite}
                onClick={openCreate}
              >
                <Plus className="size-4" />
                <span className="sm:hidden">Add</span>
                <span className="hidden sm:inline">Add {activeTabMeta.singular}</span>
              </Button>
            ) : null}
          </div>
        }
      />

      {/*
        Say which list this is. Until the server answers, the rows below are the
        ones this software ships with — that was true before and the screen
        showed them as though they were the shop's own, with every button live.
      */}
      {mounted && hydration !== "ready" ? (
        <p
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            hydration === "unavailable"
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-border bg-muted text-muted-foreground"
          )}
          role="status"
        >
          {hydration === "unavailable"
            ? "Could not load this shop's catalog. You are looking at the built-in defaults — reload the page before changing anything."
            : "Loading this shop's catalog…"}
        </p>
      ) : null}

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max min-w-full gap-1.5 pb-0.5">
          {visibleTabBar.map((tab) => {
            const isThemes = tab.id === "themes";
            const active = isThemes ? showThemes : !showThemes && activeTab === tab.id;
            return (
              <Button
                key={tab.id}
                size="sm"
                variant={active ? "bakery" : "outline"}
                onClick={() => {
                  if (isThemes) {
                    setShowThemes(true);
                    setSearch("");
                    setSelectedIds([]);
                  } else {
                    switchTab(tab.id as CatalogTab);
                  }
                }}
                className="h-8 shrink-0 gap-1.5 px-2.5 text-xs"
              >
                {tab.label}
                <Badge
                  variant={active ? "secondary" : "outline"}
                  className={cn(
                    "h-5 min-w-5 justify-center px-1.5 text-[10px]",
                    active && "border-transparent bg-primary-foreground/20 text-primary-foreground"
                  )}
                >
                  {isThemes ? "Soon" : counts[tab.id as CatalogTab]}
                </Badge>
              </Button>
            );
          })}
        </div>
      </div>

      {showThemes ? (
        <section className={adminShell.tableCard}>
          <EmptyState
            icon={Palette}
            title="Themes coming soon"
            description="Design themes (e.g. Cartoon, Floral, Minimal, Elegant) will be manageable here."
            className="py-16"
          />
        </section>
      ) : (
        <>
      <FilterPanel>
        <FilterPanelSearch
          value={search}
          onChange={setSearch}
          placeholder={`Search ${activeTabMeta.label.toLowerCase()}…`}
        />
      </FilterPanel>

      <section className={adminShell.tableCard}>
        {selectedIds.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-3 sm:px-4">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} selected
            </span>
            <Button size="sm" variant="destructive" disabled={!canWrite} onClick={handleDelete}>
              <Trash2 className="size-4" />
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
              Clear
            </Button>
          </div>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            icon={Tags}
            title={`No ${activeTabMeta.label.toLowerCase()} found`}
            description="Add an item or clear the search."
            action={
              <Button variant="bakery" onClick={openCreate}>
                <Plus className="size-4" />
                Add {activeTabMeta.singular}
              </Button>
            }
            className="py-14"
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Details</th>
                    <th className="px-4 py-3 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const id = item.id;
                    const label = "label" in item ? item.label : item.name;
                    const slug = "slug" in item ? item.slug : undefined;
                    const detail =
                      activeTab === "weights" && "modifier" in item
                        ? `+${formatCurrency(item.modifier)} · serves ${item.serves}`
                        : activeTab === "categories"
                          ? `${productsByCategory.get(item.id) ?? 0} products`
                          : slug
                            ? `/${slug}`
                            : "—";

                    return (
                      <tr
                        key={id}
                        className={cn(
                          "border-b border-border/70 transition-colors last:border-0 hover:bg-muted",
                          selectedIds.includes(id) && "bg-muted"
                        )}
                      >
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedIds.includes(id)}
                            onCheckedChange={() => toggleSelect(id)}
                            aria-label={`Select ${label}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{label}</p>
                          {slug ? (
                            <p className="text-xs text-muted-foreground">/{slug}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{detail}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => openEdit(id)}
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-border md:hidden">
              {items.map((item) => {
                const id = item.id;
                const label = "label" in item ? item.label : item.name;
                const slug = "slug" in item ? item.slug : undefined;
                const detail =
                  activeTab === "weights" && "modifier" in item
                    ? `+${formatCurrency(item.modifier)} · serves ${item.serves}`
                    : activeTab === "categories"
                      ? `${productsByCategory.get(item.id) ?? 0} products`
                      : slug
                        ? `/${slug}`
                        : null;

                return (
                  <li key={id} className="flex items-start gap-3 p-3 sm:p-4">
                    <Checkbox
                      className="mt-0.5"
                      checked={selectedIds.includes(id)}
                      onCheckedChange={() => toggleSelect(id)}
                      aria-label={`Select ${label}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {label}
                      </p>
                      {detail ? (
                        <p className="truncate text-xs text-muted-foreground">{detail}</p>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 shrink-0"
                      onClick={() => openEdit(id)}
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
        </>
      )}

      <CatalogFormDialog
        open={formOpen}
        tab={activeTab}
        itemId={editingId}
        onOpenChange={setFormOpen}
        onSaved={refresh}
      />
    </AdminPage>
  );
}
