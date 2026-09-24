"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Tags,
  Trash2, ChevronDown, ChevronUp } from "lucide-react";
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
import type { WriteResult } from "@/lib/write-result";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
// The shop's own currency. The weight modifier printed a hardcoded ₹ while
// every other price on the screen already resolved `general.currency`.
import {
  CATALOG_UPDATED_EVENT,
  deleteCategories,
  deleteCollections,
  deleteOccasions,
  moveCatalogRow,
  loadCatalogStore,
  resetCatalogStore,
} from "@/features/catalog/lib/catalog-repository";
import {
  CATALOG_HYDRATION_EVENT,
  catalogHydrationStatus,
} from "@/features/catalog/lib/catalog-api";
import {
  countByCategory,
  loadProducts,
  productsLeftUnfiled,
} from "@/features/products/lib/products-repository";
import { CatalogFormDialog } from "./catalog-form-dialog";
import { useBusinessLabels, type ShopLabels } from "@/hooks/use-business-labels";

const EMPTY_STORE: CatalogStore = {
  categories: [],
  occasions: [],
  collections: [],
  updatedAt: "",
};

/**
 * THE SHOP'S OWN WORDS FOR ITS OWN THREE LISTS.
 *
 * These were module-level constants holding "Categories", "Occasions" and
 * "Collections" — hardcoded English on the one screen whose whole job is
 * letting a shop describe its goods, while the word for the goods themselves
 * has been configurable since the labels shipped. A phone shop files under
 * Brands; a florist sells for Festivals.
 *
 * A FUNCTION of the labels rather than a constant, because the labels arrive
 * after mount and change when the shop edits them. The ids are untouched:
 * `categories` is still the tab id, the route and the database section, and
 * renaming any of those from here is how a label becomes a migration.
 */
function tabsFor(labels: ShopLabels): Array<{
  id: CatalogTab;
  label: string;
  singular: string;
}> {
  return [
    { id: "categories", label: labels.categoryWordPlural, singular: labels.categoryWord },
    { id: "occasions", label: labels.occasionWordPlural, singular: labels.occasionWord },
    { id: "collections", label: labels.collectionWordPlural, singular: labels.collectionWord },
  ];
}

// Tab bar order — includes a Themes placeholder (design-theme data model comes later).
function tabBarFor(
  labels: ShopLabels,
): Array<{ id: CatalogTab | "themes"; label: string; soon?: boolean }> {
  return [
  { id: "categories", label: labels.categoryWordPlural },
  { id: "occasions", label: labels.occasionWordPlural },
  { id: "collections", label: labels.collectionWordPlural },
  { id: "themes", label: "Themes", soon: true },
  /*
    A Weights tab stood here. Sizes are typed on the product now — a shop-wide
    list forced one product's sizes onto every other, and editing it changed
    nothing a customer could see once products stopped deriving from it.
  */
  ];
}

export function CatalogAdminPage() {
  const labels = useBusinessLabels();
  const [mounted, setMounted] = useState(false);
  const tabs = tabsFor(labels);
  const tabBar = tabBarFor(labels);
  const [activeTab, setActiveTab] = useState<CatalogTab>("categories");
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

  /*
    A module gate stood here, and Flavours was the only tab it hid.

    Flavours have left the Catalog: a flavour was never a list a shop
    maintained, it was a word typed on a product, and `modules.flavour` now
    gates that box on the product form instead. Nothing left on this screen
    is optional, so there is nothing to filter.
  */

  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    /**
     * A LOOKUP, not a growing ternary.
     *
     * Two sections fitted in a ternary; three do not, and the third would
     * have fallen into the else — so the Collections tab would have listed
     * occasions, searched them, and offered to delete them.
     */
    /*
      `isActive` and `sortOrder` are what the three lists share besides a name,
      and this screen shows both — a Hidden marker and the two arrows — so they
      belong in the shape it narrows to.
    */
    const list: {
      id: string;
      name: string;
      slug: string;
      isActive?: boolean;
      sortOrder?: number;
    }[] = {
      categories: store.categories,
      occasions: store.occasions,
      collections: store.collections,
    }[activeTab];

    /*
      SORTED THE WAY THE SHOP IS, or the arrows would appear to do nothing.

      The storefront reads these lists through `offeredRows`, which orders by
      `sortOrder` and puts an unnumbered row last. This screen read the stored
      array. `moveCatalogRow` happens to write the two in agreement, so they
      would not have drifted today — but a screen that manages an order has to
      show that order rather than one that matches it by construction.
    */
    const ordered = [...list].sort((a, b) => {
      const left = typeof a.sortOrder === "number" ? a.sortOrder : Number.POSITIVE_INFINITY;
      const right = typeof b.sortOrder === "number" ? b.sortOrder : Number.POSITIVE_INFINITY;
      if (left !== right) return left - right;
      return list.indexOf(a) - list.indexOf(b);
    });

    if (!query) return ordered;
    return ordered.filter(
      (item) =>
        item.name.toLowerCase().includes(query) || item.slug.toLowerCase().includes(query),
    );
  }, [activeTab, search, store]);

  /**
   * Read once, shared by the counts and by the orphan check.
   *
   * The orphan check needs the PRODUCTS rather than a tally: whether deleting
   * a category leaves something filed nowhere depends on what else that
   * product holds, which a count per category cannot answer.
   */
  const publishedProducts = useMemo(
    () => (mounted ? loadProducts().filter((cake) => cake.status === "published") : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted, refreshKey],
  );

  // How many published products are really in each category. `cakeCount` on the
  // category is a hand-typed number that agreed with nothing: the seed claimed
  // 48 cakes under Birthday and 271 across all categories, in a shop with 25.
  // One increment per MEMBERSHIP — see `countByCategory`, which is shared with
  // the homepage tiles so the two screens cannot disagree about a number.
  const productsByCategory = useMemo(
    () => countByCategory(publishedProducts),
    [publishedProducts],
  );

  const counts: Record<CatalogTab, number> = {
    categories: store.categories.length,
    occasions: store.occasions.length,
    collections: store.collections.length,
  };

  const totalItems = Object.values(counts).reduce((sum, n) => sum + n, 0);
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

  /**
   * Products left filed NOWHERE by deleting the current selection.
   *
   * This summed the per-category tallies, which was right while a product had
   * exactly one category and is wrong twice over now: it counts a product filed
   * in two of the doomed categories TWICE, and it counts a product that keeps a
   * category outside the selection as orphaned when it is not.
   *
   * Both errors point the same way — the only warning attached to a destructive
   * action over-reports — and an owner who checks it once, finds it wrong, and
   * stops reading it is worse off than one who was never warned.
   */
  function orphanCount(): number {
    if (activeTab !== "categories") return 0;
    return productsLeftUnfiled(publishedProducts, selectedIds).length;
  }

  /**
   * Move one row up or down its list.
   *
   * The repository renumbers the WHOLE list rather than swapping two values,
   * because most rows have never carried a `sortOrder` — see the note there.
   * Nothing is reported on success: the list redraws with the row in its new
   * place, which is the feedback. A refused write is worth a word.
   */
  async function handleMove(id: string, direction: -1 | 1) {
    const { persisted } = await moveCatalogRow(activeTab, id, direction);
    refresh();
    if (!persisted) reportWrite(false, "Order saved");
  }

  async function handleDelete() {
    if (selectedIds.length === 0) return;

    // Nothing reassigns or blocks a product whose category is deleted. It keeps
    // pointing at an id nothing resolves, so the storefront labels it the
    // generic "Cakes" and the admin category filter can never find it again.
    // Three of this shop's products are already in that state.
    const orphans = orphanCount();
    if (orphans > 0) {
      const noun = orphans === 1 ? `${labels.productWord.toLowerCase()} is` : `${labels.productWordPlural.toLowerCase()} are`;
      const which =
        selectedIds.length === 1
          ? labels.categoryWord.toLowerCase()
          : labels.categoryWordPlural.toLowerCase();
      const ok = window.confirm(
        `${orphans} published ${noun} still in the ${which} you are deleting.\n\n` +
          "That is every category they are filed under, so they will be left " +
          "pointing at nothing: the shop will show them as uncategorised, and " +
          "the category filter here will never find them again.\n\n" +
          "Anything filed somewhere else as well is not counted here and keeps " +
          "its other categories.\n\nDelete anyway?"
      );
      if (!ok) return;
    }
    /*
      KEYED ON THE TAB, not an either/or.

      This was `activeTab === "categories" ? deleteCategories : deleteOccasions`,
      written when there were two tabs. Collections arrived as a third and fell
      into the else — so selecting a collection and pressing Delete filtered the
      OCCASIONS list by a collection's id, matched nothing, wrote the occasions
      back unchanged, and reported "Deleted 0 items". `deleteCollections` was
      written at the same time as the tab and has never been called.

      A map rather than a chain, because the next tab added to this screen will
      be a missing key here — a crash in development — and not a silent write to
      whichever list the else happened to name.
    */
    const removers: Record<CatalogTab, (ids: string[]) => Promise<WriteResult<number>>> = {
      categories: deleteCategories,
      occasions: deleteOccasions,
      collections: deleteCollections,
    };
    const remove = removers[activeTab];

    const { value: count, persisted } = await remove(selectedIds);
    refresh();
    reportWrite(persisted, `Deleted ${count} item${count === 1 ? "" : "s"}`);
  }

  async function handleReset() {
    // One click on "Reset defaults" replaced every taxonomy in the database
    // with the shipped ones, unconfirmed. Everything a shop had named — its
    // categories and occasions — gone, and every product left pointing at ids
    // that no longer existed.
    const ok = window.confirm(
      `This replaces both lists — ${counts.categories} categories and ` +
        `${counts.occasions} occasions — ` +
        `with the ones this software ships with.\n\n` +
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
                  {items.map((item, index) => {
                    const id = item.id;
                    const label = item.name;
                    const slug = item.slug;
                    const detail =
                      activeTab === "categories"
                        ? `${productsByCategory.get(item.id) ?? 0} ${labels.productWordPlural.toLowerCase()}`
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
                          <p className="font-medium text-foreground">
                            {label}
                            {/*
                              A row switched off still appears HERE — this is
                              where the shop manages it — and says so, because
                              the alternative is an owner looking at a row that
                              is on this screen and not on their shop with
                              nothing to explain the difference.
                            */}
                            {item.isActive === false ? (
                              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                                Hidden
                              </span>
                            ) : null}
                          </p>
                          {slug ? (
                            <p className="text-xs text-muted-foreground">/{slug}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{detail}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {/*
                              Disabled at the ends rather than hidden, so the
                              rows do not change width as you move one down a
                              long list.
                            */}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8"
                              disabled={!canWrite || index === 0}
                              aria-label={`Move ${label} up`}
                              onClick={() => void handleMove(id, -1)}
                            >
                              <ChevronUp className="size-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8"
                              disabled={!canWrite || index === items.length - 1}
                              aria-label={`Move ${label} down`}
                              onClick={() => void handleMove(id, 1)}
                            >
                              <ChevronDown className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => openEdit(id)}
                            >
                              <Pencil className="size-3.5" />
                              Edit
                            </Button>
                          </div>
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
                const label = item.name;
                const slug = item.slug;
                const detail =
                  activeTab === "categories"
                    ? `${productsByCategory.get(item.id) ?? 0} ${labels.productWordPlural.toLowerCase()}`
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
                        {item.isActive === false ? (
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                            Hidden
                          </span>
                        ) : null}
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
