"use client";

import Link from "next/link";
import { SafeImage } from "@/components/shared/safe-image";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Cake,
  CheckCircle2,
  ExternalLink,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  FilterPanel,
  FilterPanelSearch,
} from "@/components/shared/filter-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { DashboardStatCard } from "@/apps/admin/dashboard/components/dashboard-stat-card";
import { AdminPage, AdminPageHeader, adminShell } from "@/apps/admin/components";
import { StockStatusBadge } from "@/apps/admin/commerce/components/stock-status-badge";
import { deriveStockStatus } from "@/apps/admin/commerce/lib/inventory-utils";
import { getInventorySettings } from "@/apps/admin/commerce/lib/inventory-repository";
import { routes } from "@/constants/routes";
import type { Product as CakeEntity, EntityStatus } from "@/types";
import { formatCurrency, formatRelativeTime } from "@/utils/format";
import { adminCategories } from "@/features/products/lib/catalog-options";
import {
  deleteProductRequest,
  fetchProducts,
  updateProductRequest,
} from "@/features/products/data/products-client";
import {
  defaultProductListFilters,
  formatStatusLabel,
  type ProductListFilters,
} from "@/features/products/lib/product-utils";
import { AdminSelect } from "./admin-field";
import { DeleteProductDialog } from "./delete-product-dialog";

const PAGE_SIZE = 10;

const EMPTY_STATS = {
  total: 0,
  published: 0,
  draft: 0,
  lowStock: 0,
};

function getStatusVariant(status: EntityStatus): "success" | "outline" | "secondary" {
  if (status === "published") return "success";
  if (status === "draft") return "outline";
  return "secondary";
}

function filterProducts(cakes: CakeEntity[], filters: ProductListFilters): CakeEntity[] {
  const query = filters.search.trim().toLowerCase();
  const settings = getInventorySettings();

  return cakes
    .filter((cake) => {
      if (query) {
        const categoryName =
          adminCategories().find((c) => c.id === cake.categoryId)?.name ?? "";
        const haystack = `${cake.name} ${cake.slug} ${categoryName}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (filters.categoryId !== "all" && cake.categoryId !== filters.categoryId) {
        return false;
      }
      if (filters.status !== "all" && cake.status !== filters.status) return false;
      if (filters.flag === "featured" && !cake.isFeatured) return false;
      if (filters.flag === "trending" && !cake.isTrending) return false;
      if (filters.flag === "best-seller" && !cake.isBestSeller) return false;
      if (filters.productType === "eggless" && !cake.isEggless) return false;
      if (filters.productType === "photo" && !cake.isPhotoCake) return false;
      if (filters.productType === "seasonal" && !cake.isSeasonal) return false;
      if (filters.stock !== "all") {
        const derivedStatus = deriveStockStatus(cake, settings);
        if (filters.stock === "unlimited") {
          if (!cake.unlimitedStock) return false;
        } else if (derivedStatus !== filters.stock) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (filters.sort === "price-asc") return a.price - b.price;
      if (filters.sort === "price-desc") return b.price - a.price;
      if (filters.sort === "name") return a.name.localeCompare(b.name);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
}

export function ProductsListPage() {
  const [mounted, setMounted] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cakes, setCakes] = useState<CakeEntity[]>([]);
  const [filters, setFilters] = useState<ProductListFilters>(defaultProductListFilters);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{
    ids: string[];
    name?: string;
  } | null>(null);

  async function refresh() {
    try {
      setCakes(await fetchProducts());
      setLoadError(null);
    } catch (error) {
      // Leave the previous list on screen rather than blanking the table.
      setLoadError(error instanceof Error ? error.message : "Failed to load products");
    } finally {
      setMounted(true);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => filterProducts(cakes, filters), [cakes, filters]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const stats = useMemo(() => {
    if (!mounted) return EMPTY_STATS;
    const settings = getInventorySettings();
    return {
      total: cakes.length,
      published: cakes.filter((cake) => cake.status === "published").length,
      draft: cakes.filter((cake) => cake.status === "draft").length,
      lowStock: cakes.filter((cake) => deriveStockStatus(cake, settings) === "low_stock")
        .length,
    };
  }, [cakes, mounted]);

  const allOnPageSelected =
    paginated.length > 0 && paginated.every((cake) => selectedIds.includes(cake.id));

  function updateFilters(patch: Partial<ProductListFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
    setSelectedIds([]);
  }

  function toggleSelectAllOnPage() {
    if (allOnPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !paginated.some((c) => c.id === id)));
      return;
    }
    setSelectedIds((prev) => [...new Set([...prev, ...paginated.map((c) => c.id)])]);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  /** Applies a status to every selected product, reporting partial failures. */
  async function applyBulkStatus(status: EntityStatus, verb: string) {
    const targets = cakes.filter((cake) => selectedIds.includes(cake.id));
    const results = await Promise.allSettled(
      targets.map((cake) => {
        const { id: _id, createdAt: _c, updatedAt: _u, ...data } = cake;
        return updateProductRequest(cake.id, { ...data, status });
      })
    );

    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - ok;

    await refresh();
    setSelectedIds([]);

    if (ok > 0) toast.success(`${ok} cake${ok === 1 ? "" : "s"} ${verb}`);
    if (failed > 0) toast.error(`${failed} cake${failed === 1 ? "" : "s"} failed to ${verb === "published" ? "publish" : "archive"}`);
  }

  function handleBulkPublish() {
    void applyBulkStatus("published", "published");
  }

  function handleBulkArchive() {
    void applyBulkStatus("archived", "archived");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const ids = deleteTarget.ids;
    const results = await Promise.allSettled(ids.map((id) => deleteProductRequest(id)));

    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - ok;

    await refresh();
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    setDeleteTarget(null);

    if (ok > 0) toast.success(`${ok} cake${ok === 1 ? "" : "s"} deleted`);
    if (failed > 0) toast.error(`${failed} cake${failed === 1 ? "" : "s"} could not be deleted`);
  }

  function categoryName(categoryId: string) {
    return adminCategories().find((item) => item.id === categoryId)?.name ?? "—";
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Cakes"
        description="Manage your cake catalog"
        className="gap-3"
        actions={
          <Button
            variant="bakery"
            className="w-full sm:w-auto"
            render={<Link href={routes.admin.cakes.add} />}
          >
            <Plus className="size-4" />
            <span className="sm:hidden">Add</span>
            <span className="hidden sm:inline">Add Cake</span>
          </Button>
        }
      />

      {/* Without this a failed load leaves an empty table and no explanation,
          which reads as "you have no cakes". */}
      {loadError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          <span className="text-destructive">{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            Try again
          </Button>
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "all", stock: "all", search: "" })}
        >
          <DashboardStatCard
            title="Total"
            value={stats.total}
            change="All cakes"
            changeTone="neutral"
            icon={Cake}
            tone="bakery"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "published" })}
        >
          <DashboardStatCard
            title="Published"
            value={stats.published}
            change="Live on storefront"
            changeTone="positive"
            icon={CheckCircle2}
            tone="gold"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "draft" })}
        >
          <DashboardStatCard
            title="Drafts"
            value={stats.draft}
            change="Not published"
            changeTone="neutral"
            icon={FileText}
            tone="neutral"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ stock: "low_stock", status: "all" })}
        >
          <DashboardStatCard
            title="Low stock"
            value={stats.lowStock}
            change={stats.lowStock > 0 ? "Needs restock" : "Stock healthy"}
            changeTone={stats.lowStock > 0 ? "warning" : "positive"}
            icon={AlertTriangle}
            tone="bakery"
          />
        </button>
      </section>

      <FilterPanel>
        <div className="space-y-3">
          <FilterPanelSearch
            value={filters.search}
            onChange={(value) => updateFilters({ search: value })}
            placeholder="Search cakes…"
          />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            <AdminSelect
              value={filters.categoryId}
              onChange={(event) => updateFilters({ categoryId: event.target.value })}
              className="w-full"
              aria-label="Category"
            >
              <option value="all">All categories</option>
              {(mounted ? adminCategories() : []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </AdminSelect>
            <AdminSelect
              value={filters.status}
              onChange={(event) =>
                updateFilters({ status: event.target.value as ProductListFilters["status"] })
              }
              className="w-full"
              aria-label="Status"
            >
              <option value="all">All status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </AdminSelect>
            <AdminSelect
              value={filters.stock}
              onChange={(event) =>
                updateFilters({ stock: event.target.value as ProductListFilters["stock"] })
              }
              className="w-full"
              aria-label="Stock"
            >
              <option value="all">All stock</option>
              <option value="in_stock">In stock</option>
              <option value="low_stock">Low stock</option>
              <option value="out_of_stock">Out of stock</option>
              <option value="unlimited">Unlimited</option>
            </AdminSelect>
            <AdminSelect
              value={filters.flag}
              onChange={(event) =>
                updateFilters({ flag: event.target.value as ProductListFilters["flag"] })
              }
              className="w-full"
              aria-label="Flag"
            >
              <option value="all">All flags</option>
              <option value="featured">Featured</option>
              <option value="trending">Trending</option>
              <option value="best-seller">Best Seller</option>
            </AdminSelect>
            <AdminSelect
              value={filters.productType}
              onChange={(event) =>
                updateFilters({
                  productType: event.target.value as ProductListFilters["productType"],
                })
              }
              className="w-full"
              aria-label="Product type"
            >
              <option value="all">All types</option>
              <option value="eggless">Eggless</option>
              <option value="photo">Photo</option>
              <option value="seasonal">Seasonal</option>
            </AdminSelect>
            <AdminSelect
              value={filters.sort}
              onChange={(event) =>
                updateFilters({ sort: event.target.value as ProductListFilters["sort"] })
              }
              className="w-full"
              aria-label="Sort"
            >
              <option value="updated">Recently updated</option>
              <option value="name">Name</option>
              <option value="price-asc">Price low–high</option>
              <option value="price-desc">Price high–low</option>
            </AdminSelect>
          </div>
        </div>
      </FilterPanel>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Cake}
          title="No cakes found"
          description="Try another filter, or add your first cake."
          action={
            <Button variant="bakery" render={<Link href={routes.admin.cakes.add} />}>
              <Plus className="size-4" />
              Add Cake
            </Button>
          }
        />
      ) : (
        <section className={adminShell.tableCard}>
          {selectedIds.length > 0 ? (
            <div className="flex flex-col gap-2 border-b border-border px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-4">
              <span className="text-sm text-muted-foreground">
                {selectedIds.length} selected
              </span>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleBulkPublish}>
                  Publish
                </Button>
                <Button size="sm" variant="outline" onClick={handleBulkArchive}>
                  Archive
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setDeleteTarget({ ids: selectedIds })}
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                  Clear
                </Button>
              </div>
            </div>
          ) : null}

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3">
                    <Checkbox
                      checked={allOnPageSelected}
                      onCheckedChange={toggleSelectAllOnPage}
                      aria-label="Select all on page"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">Cake</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((cake) => (
                  <tr
                    key={cake.id}
                    className="border-b border-border/70 transition-colors last:border-0 hover:bg-muted"
                  >
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedIds.includes(cake.id)}
                        onCheckedChange={() => toggleSelect(cake.id)}
                        aria-label={`Select ${cake.name}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                          {cake.images[0] ? (
                            <SafeImage
                              src={cake.images[0]}
                              alt={cake.name}
                              className="object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{cake.name}</p>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {cake.isFeatured ? (
                              <Badge variant="gold" className="text-[10px]">
                                Featured
                              </Badge>
                            ) : null}
                            {cake.isTrending ? (
                              <Badge variant="outline" className="text-[10px]">
                                Trending
                              </Badge>
                            ) : null}
                            {cake.isBestSeller ? (
                              <Badge variant="bakery" className="text-[10px]">
                                Best Seller
                              </Badge>
                            ) : null}
                            {cake.isEggless ? (
                              <Badge variant="outline" className="text-[10px]">
                                Eggless
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {categoryName(cake.categoryId)}
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(cake.price)}</td>
                    <td className="px-4 py-3">
                      <StockStatusBadge
                        status={deriveStockStatus(cake, getInventorySettings())}
                        unlimited={cake.unlimitedStock}
                        quantity={cake.stockQuantity}
                        showQuantity
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusVariant(cake.status)}>
                        {formatStatusLabel(cake.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatRelativeTime(cake.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon" aria-label="Row actions" />
                          }
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            render={<Link href={routes.admin.cakes.edit(cake.id)} />}
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            render={<Link href={routes.admin.cakes.preview(cake.id)} />}
                          >
                            <ExternalLink className="size-3.5" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() =>
                              setDeleteTarget({ ids: [cake.id], name: cake.name })
                            }
                          >
                            <Trash2 className="size-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-border lg:hidden">
            {paginated.map((cake) => (
              <li key={cake.id} className="p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    className="mt-1"
                    checked={selectedIds.includes(cake.id)}
                    onCheckedChange={() => toggleSelect(cake.id)}
                    aria-label={`Select ${cake.name}`}
                  />
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                    {cake.images[0] ? (
                      <SafeImage
                        src={cake.images[0]}
                        alt={cake.name}
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {cake.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {categoryName(cake.categoryId)} · {formatCurrency(cake.price)}
                        </p>
                      </div>
                      <Badge variant={getStatusVariant(cake.status)}>
                        {formatStatusLabel(cake.status)}
                      </Badge>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 flex-1"
                        render={<Link href={routes.admin.cakes.edit(cake.id)} />}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 flex-1"
                        render={<Link href={routes.admin.cakes.preview(cake.id)} />}
                      >
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() =>
                          setDeleteTarget({ ids: [cake.id], name: cake.name })
                        }
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="border-t border-border px-3 py-3 sm:px-4">
            <ListPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </section>
      )}

      <DeleteProductDialog
        open={Boolean(deleteTarget)}
        cakeName={deleteTarget?.name}
        count={deleteTarget?.ids.length}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </AdminPage>
  );
}
