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
import { toast } from "sonner";
import {
  FilterPanel,
  FilterPanelSearch,
} from "@/components/shared/filter-panel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/shared/empty-state";
import { AdminPage, AdminPageHeader, adminShell } from "@/features/admin/components";
import type { CatalogStore, CatalogTab } from "@/types/catalog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  deleteCategories,
  deleteFlavours,
  deleteOccasions,
  deleteWeightOptions,
  loadCatalogStore,
  resetCatalogStore,
} from "../lib/catalog-repository";
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
  const [showThemes, setShowThemes] = useState(false);
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const store = useMemo(
    () => (mounted ? loadCatalogStore() : EMPTY_STORE),
    [mounted, refreshKey]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

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

  function handleDelete() {
    if (selectedIds.length === 0) return;
    let count = 0;
    if (activeTab === "categories") count = deleteCategories(selectedIds);
    else if (activeTab === "flavours") count = deleteFlavours(selectedIds);
    else if (activeTab === "occasions") count = deleteOccasions(selectedIds);
    else count = deleteWeightOptions(selectedIds);
    refresh();
    toast.success(`Deleted ${count} item${count === 1 ? "" : "s"}`);
  }

  function handleReset() {
    resetCatalogStore();
    refresh();
    toast.success("Catalog reset to defaults");
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Catalog"
        description={
          showThemes
            ? "Cake design themes — coming soon"
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

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max min-w-full gap-1.5 pb-0.5">
          {tabBar.map((tab) => {
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
            description="Cake design themes (e.g. Cartoon, Floral, Minimal, Elegant) will be manageable here."
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
            <Button size="sm" variant="destructive" onClick={handleDelete}>
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
                        ? `+₹${item.modifier} · serves ${item.serves}`
                        : activeTab === "categories" && "cakeCount" in item
                          ? `${item.cakeCount ?? 0} cakes`
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
                    ? `+₹${item.modifier} · serves ${item.serves}`
                    : activeTab === "categories" && "cakeCount" in item
                      ? `${item.cakeCount ?? 0} cakes`
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
