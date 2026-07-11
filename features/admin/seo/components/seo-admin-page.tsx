"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  FileText,
  Globe,
  Link2,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Save,
  Search,
  ShieldOff,
} from "lucide-react";
import { toast } from "sonner";
import { AdminSelect, adminTextareaClassName } from "@/features/admin/cakes/components/admin-field";
import { CakeMediaPicker } from "@/features/admin/cakes/components/cake-media-picker";
import {
  FilterPanel,
  FilterPanelSearch,
  FilterPanelToolbar,
} from "@/components/shared/filter-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { DashboardStatCard } from "@/features/admin/dashboard/components/dashboard-stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/utils/format";
import type { GlobalSeoSettings, SeoRouteEntry } from "@/types/seo";
import { AdminMobileActionBar, AdminPage, AdminPageHeader, adminShell } from "@/features/admin/components";
import {
  loadSeoStore,
  resetSeoStore,
  saveGlobalSeo,
} from "../lib/seo-repository";
import {
  DESCRIPTION_IDEAL_MAX,
  TITLE_IDEAL_MAX,
  buildCanonicalUrl,
  charCountTone,
  countChars,
  defaultSeoRouteFilters,
  filterSeoRouteList,
  getSeoOverview,
  isValidJson,
  parseKeywords,
  type SeoOverview,
  type SeoRouteListFilters,
} from "../lib/seo-metadata";
import { SeoRouteEditDialog } from "./seo-route-edit-dialog";

const EMPTY_OVERVIEW: SeoOverview = {
  total: 0,
  indexable: 0,
  noindex: 0,
  nofollow: 0,
  sitemapCount: 0,
  indexingAllowed: true,
};

const PLACEHOLDER_GLOBAL: GlobalSeoSettings = {
  siteName: "",
  titleSuffix: "",
  defaultDescription: "",
  defaultOgImage: "",
  defaultKeywords: [],
  canonicalBaseUrl: "",
  allowIndexing: true,
  defaultTwitterCard: "summary_large_image",
};

function serializeGlobal(global: GlobalSeoSettings, keywordsInput: string): string {
  return JSON.stringify({
    ...global,
    defaultKeywords: parseKeywords(keywordsInput),
    googleSiteVerification: global.googleSiteVerification ?? "",
    twitterSite: global.twitterSite ?? "",
    twitterCreator: global.twitterCreator ?? "",
    organizationSchemaJson: global.organizationSchemaJson ?? "",
  });
}

function SeoRowActions({
  localPath,
  onEdit,
}: {
  localPath: string;
  onEdit: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Row actions" />}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="size-3.5" />
          Edit SEO
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<a href={localPath} target="_blank" rel="noreferrer" />}>
          <ExternalLink className="size-3.5" />
          Open page
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SeoAdminPage() {
  const [mounted, setMounted] = useState(false);
  const [global, setGlobal] = useState<GlobalSeoSettings>(PLACEHOLDER_GLOBAL);
  const [savedGlobal, setSavedGlobal] = useState<GlobalSeoSettings>(PLACEHOLDER_GLOBAL);
  const [seoRoutes, setSeoRoutes] = useState<SeoRouteEntry[]>([]);
  const [filters, setFilters] = useState<SeoRouteListFilters>(defaultSeoRouteFilters);
  const [editingEntry, setEditingEntry] = useState<SeoRouteEntry | null>(null);
  const [keywordsInput, setKeywordsInput] = useState("");
  const [savedKeywordsInput, setSavedKeywordsInput] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);

  function refresh() {
    const store = loadSeoStore();
    setGlobal(store.global);
    setSavedGlobal(store.global);
    setSeoRoutes(store.routes);
    const keywords = store.global.defaultKeywords.join(", ");
    setKeywordsInput(keywords);
    setSavedKeywordsInput(keywords);
    setMounted(true);
  }

  function refreshRoutesOnly() {
    const store = loadSeoStore();
    setSeoRoutes(store.routes);
  }

  useEffect(() => {
    refresh();
  }, []);

  const isDirty = useMemo(
    () => serializeGlobal(global, keywordsInput) !== serializeGlobal(savedGlobal, savedKeywordsInput),
    [global, keywordsInput, savedGlobal, savedKeywordsInput]
  );

  const overview = useMemo(
    () => (mounted ? getSeoOverview(seoRoutes, global) : EMPTY_OVERVIEW),
    [mounted, seoRoutes, global]
  );

  const filtered = useMemo(
    () => filterSeoRouteList(seoRoutes, filters),
    [seoRoutes, filters]
  );

  const filtersActive =
    filters.search.trim() !== "" ||
    filters.status !== "all" ||
    filters.sort !== "label";

  useEffect(() => {
    if (!isDirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  function updateFilters(patch: Partial<SeoRouteListFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  function handleSaveGlobal() {
    if (!global.siteName.trim() || !global.canonicalBaseUrl.trim()) {
      toast.error("Site name and canonical base URL are required");
      return;
    }
    if (!isValidJson(global.organizationSchemaJson ?? "")) {
      toast.error("Organization schema must be valid JSON");
      return;
    }

    const saved = saveGlobalSeo({
      ...global,
      defaultKeywords: parseKeywords(keywordsInput),
    });
    setGlobal(saved);
    setSavedGlobal(saved);
    const keywords = saved.defaultKeywords.join(", ");
    setKeywordsInput(keywords);
    setSavedKeywordsInput(keywords);
    toast.success("Global SEO settings saved");
  }

  function handleDiscard() {
    setGlobal(savedGlobal);
    setKeywordsInput(savedKeywordsInput);
    toast.message("Discarded unsaved changes");
  }

  function confirmReset() {
    resetSeoStore();
    refresh();
    setResetOpen(false);
    toast.success("SEO settings reset to defaults");
  }

  return (
    <AdminPage className={cn("space-y-4 sm:space-y-5", isDirty && "pb-20 md:pb-0")}>
      <AdminPageHeader
        title="SEO"
        description="Manage meta tags, Open Graph, and page-level SEO"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setResetOpen(true)}
            >
              <RotateCcw className="size-4" />
              Reset
            </Button>
            {isDirty ? (
              <Button variant="outline" className="w-full sm:w-auto" onClick={handleDiscard}>
                Discard
              </Button>
            ) : null}
            <Button
              variant="bakery"
              className="w-full sm:w-auto"
              onClick={handleSaveGlobal}
              disabled={!isDirty || !isValidJson(global.organizationSchemaJson ?? "")}
            >
              <Save className="size-4" />
              Save global SEO
            </Button>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "all" })}
        >
          <DashboardStatCard
            title="Routes"
            value={overview.total}
            change="Managed pages"
            changeTone="neutral"
            icon={FileText}
            tone="bakery"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "indexable" })}
        >
          <DashboardStatCard
            title="Indexable"
            value={overview.indexable}
            change={overview.indexingAllowed ? "Allowed globally" : "Global block on"}
            changeTone={overview.indexingAllowed ? "positive" : "warning"}
            icon={Globe}
            tone="bakery"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "noindex" })}
        >
          <DashboardStatCard
            title="Noindex"
            value={overview.noindex}
            change="Hidden from search"
            changeTone={overview.noindex > 0 ? "warning" : "neutral"}
            icon={ShieldOff}
            tone={overview.noindex > 0 ? "gold" : "neutral"}
          />
        </button>
        <DashboardStatCard
          title="Sitemap"
          value={overview.sitemapCount}
          change="Live entries"
          changeTone="neutral"
          icon={Link2}
          tone="neutral"
        />
      </section>

      {!mounted ? (
        <div className="min-h-64 animate-pulse rounded-xl border border-border bg-muted" />
      ) : (
        <>
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Global defaults</CardTitle>
                  <CardDescription>
                    Site-wide SEO fallbacks used when a page does not override a field.
                  </CardDescription>
                </div>
                {isDirty ? <Badge variant="warning">Unsaved</Badge> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="site-name">Site name</Label>
                  <Input
                    id="site-name"
                    value={global.siteName}
                    onChange={(e) =>
                      setGlobal((prev) => ({ ...prev, siteName: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title-suffix">Title suffix</Label>
                  <Input
                    id="title-suffix"
                    value={global.titleSuffix}
                    onChange={(e) =>
                      setGlobal((prev) => ({ ...prev, titleSuffix: e.target.value }))
                    }
                    placeholder="| Monginis"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="default-description">Default meta description</Label>
                  <span
                    className={`text-xs ${charCountTone(
                      countChars(global.defaultDescription),
                      DESCRIPTION_IDEAL_MAX
                    )}`}
                  >
                    {countChars(global.defaultDescription)}/{DESCRIPTION_IDEAL_MAX}
                  </span>
                </div>
                <textarea
                  id="default-description"
                  className={adminTextareaClassName}
                  value={global.defaultDescription}
                  onChange={(e) =>
                    setGlobal((prev) => ({ ...prev, defaultDescription: e.target.value }))
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="canonical-base">Canonical base URL</Label>
                  <Input
                    id="canonical-base"
                    value={global.canonicalBaseUrl}
                    onChange={(e) =>
                      setGlobal((prev) => ({ ...prev, canonicalBaseUrl: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="default-og">Default OG image</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setMediaOpen(true)}
                    >
                      Media
                    </Button>
                  </div>
                  <Input
                    id="default-og"
                    value={global.defaultOgImage}
                    onChange={(e) =>
                      setGlobal((prev) => ({ ...prev, defaultOgImage: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-keywords">Default keywords</Label>
                <Input
                  id="default-keywords"
                  value={keywordsInput}
                  onChange={(e) => setKeywordsInput(e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="google-verification">Google site verification</Label>
                  <Input
                    id="google-verification"
                    value={global.googleSiteVerification ?? ""}
                    onChange={(e) =>
                      setGlobal((prev) => ({
                        ...prev,
                        googleSiteVerification: e.target.value,
                      }))
                    }
                    placeholder="Optional verification code"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="allow-indexing">Search indexing</Label>
                  <AdminSelect
                    id="allow-indexing"
                    value={global.allowIndexing ? "allow" : "block"}
                    onChange={(e) =>
                      setGlobal((prev) => ({
                        ...prev,
                        allowIndexing: e.target.value === "allow",
                      }))
                    }
                  >
                    <option value="allow">Allow indexing</option>
                    <option value="block">Block indexing globally</option>
                  </AdminSelect>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="twitter-site">Twitter @site</Label>
                  <Input
                    id="twitter-site"
                    value={global.twitterSite ?? ""}
                    onChange={(e) =>
                      setGlobal((prev) => ({ ...prev, twitterSite: e.target.value }))
                    }
                    placeholder="@monginis"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitter-creator">Twitter @creator</Label>
                  <Input
                    id="twitter-creator"
                    value={global.twitterCreator ?? ""}
                    onChange={(e) =>
                      setGlobal((prev) => ({ ...prev, twitterCreator: e.target.value }))
                    }
                    placeholder="@monginis"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitter-card">Default Twitter card</Label>
                  <AdminSelect
                    id="twitter-card"
                    value={global.defaultTwitterCard}
                    onChange={(e) =>
                      setGlobal((prev) => ({
                        ...prev,
                        defaultTwitterCard: e.target
                          .value as GlobalSeoSettings["defaultTwitterCard"],
                      }))
                    }
                  >
                    <option value="summary_large_image">Summary large image</option>
                    <option value="summary">Summary</option>
                  </AdminSelect>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="organization-schema">Organization schema (JSON-LD)</Label>
                <textarea
                  id="organization-schema"
                  className={adminTextareaClassName}
                  rows={8}
                  value={global.organizationSchemaJson ?? ""}
                  onChange={(e) =>
                    setGlobal((prev) => ({
                      ...prev,
                      organizationSchemaJson: e.target.value,
                    }))
                  }
                  aria-invalid={
                    Boolean(global.organizationSchemaJson) &&
                    !isValidJson(global.organizationSchemaJson ?? "")
                  }
                />
                <p
                  className={`text-xs ${
                    isValidJson(global.organizationSchemaJson ?? "")
                      ? "text-muted-foreground"
                      : "text-destructive"
                  }`}
                >
                  {isValidJson(global.organizationSchemaJson ?? "")
                    ? "Demo placeholder for structured data."
                    : "Invalid JSON — fix before saving."}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div>
              <h2 className="font-heading text-lg font-semibold">Page SEO</h2>
              <p className="text-sm text-muted-foreground">
                Per-route meta titles, descriptions, and Open Graph overrides.
              </p>
            </div>

            <FilterPanel>
              <FilterPanelToolbar>
                <FilterPanelSearch
                  value={filters.search}
                  onChange={(value) => updateFilters({ search: value })}
                  placeholder="Search pages by label, path, or meta…"
                />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:w-auto">
                  <AdminSelect
                    value={filters.status}
                    onChange={(e) =>
                      updateFilters({
                        status: e.target.value as SeoRouteListFilters["status"],
                      })
                    }
                  >
                    <option value="all">All statuses</option>
                    <option value="indexable">Indexable</option>
                    <option value="noindex">Noindex</option>
                    <option value="nofollow">Nofollow</option>
                  </AdminSelect>
                  <AdminSelect
                    value={filters.sort}
                    onChange={(e) =>
                      updateFilters({
                        sort: e.target.value as SeoRouteListFilters["sort"],
                      })
                    }
                  >
                    <option value="label">Label</option>
                    <option value="title">Meta title</option>
                    <option value="updated">Recently updated</option>
                  </AdminSelect>
                </div>
              </FilterPanelToolbar>

              {filtersActive ? (
                <div className="mt-3 flex justify-end border-t border-border pt-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setFilters(defaultSeoRouteFilters)}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : null}
            </FilterPanel>

            {filtered.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No SEO routes found"
                description={
                  filtersActive
                    ? "Try adjusting your filters or search."
                    : "SEO routes will appear here once seeded."
                }
              />
            ) : (
              <div className={adminShell.tableCard}>
                <div className="hidden md:block">
                  <div className={adminShell.tableScroll}>
                    <table className="w-full min-w-[720px] text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                          <th className="px-4 py-3 font-medium">Page</th>
                          <th className="px-4 py-3 font-medium">Meta title</th>
                          <th className="hidden px-4 py-3 font-medium lg:table-cell">
                            Description
                          </th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Updated</th>
                          <th className="px-4 py-3 font-medium">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((entry) => (
                          <tr
                            key={entry.id}
                            className="border-b border-border/60 last:border-0"
                          >
                            <td className="px-4 py-3">
                              <p className="font-medium">{entry.label}</p>
                              <p className="text-xs text-muted-foreground">{entry.path}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="line-clamp-1">{entry.metaTitle}</p>
                              <p
                                className={`text-xs ${charCountTone(
                                  countChars(entry.metaTitle),
                                  TITLE_IDEAL_MAX
                                )}`}
                              >
                                {countChars(entry.metaTitle)} chars
                              </p>
                            </td>
                            <td className="hidden px-4 py-3 lg:table-cell">
                              <p className="line-clamp-2 text-muted-foreground">
                                {entry.metaDescription}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={entry.noIndex ? "outline" : "success"}>
                                {entry.noIndex
                                  ? "Noindex"
                                  : entry.noFollow
                                    ? "Nofollow"
                                    : "Indexable"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {formatRelativeTime(entry.updatedAt)}
                            </td>
                            <td className="px-4 py-3">
                              <SeoRowActions
                                localPath={entry.path}
                                onEdit={() => setEditingEntry(entry)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <ul className="divide-y divide-border md:hidden">
                  {filtered.map((entry) => (
                    <li key={entry.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{entry.label}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {entry.path}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Badge variant={entry.noIndex ? "outline" : "success"}>
                            {entry.noIndex
                              ? "Noindex"
                              : entry.noFollow
                                ? "Nofollow"
                                : "Indexable"}
                          </Badge>
                          <SeoRowActions
                            localPath={entry.path}
                            onEdit={() => setEditingEntry(entry)}
                          />
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm">{entry.metaTitle}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {entry.metaDescription}
                      </p>
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {formatRelativeTime(entry.updatedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Sitemap & robots</CardTitle>
              <CardDescription>
                Generated from indexable SEO routes in this demo environment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Live sitemap entries:{" "}
                <span className="font-semibold text-foreground">{overview.sitemapCount}</span>
              </p>
              <p>
                Sitemap URL:{" "}
                <a
                  href="/sitemap.xml"
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-primary hover:underline"
                >
                  {buildCanonicalUrl("/sitemap.xml", global)}
                </a>
              </p>
              <p>
                Robots URL:{" "}
                <a
                  href="/robots.txt"
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-primary hover:underline"
                >
                  {buildCanonicalUrl("/robots.txt", global)}
                </a>
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {isDirty ? (
        <AdminMobileActionBar className="md:hidden">
          <Button variant="outline" className="flex-1" onClick={handleDiscard}>
            Discard
          </Button>
          <Button
            variant="bakery"
            className="flex-1"
            onClick={handleSaveGlobal}
            disabled={!isValidJson(global.organizationSchemaJson ?? "")}
          >
            <Save className="size-4" />
            Save
          </Button>
        </AdminMobileActionBar>
      ) : null}

      <SeoRouteEditDialog
        open={Boolean(editingEntry)}
        entry={editingEntry}
        global={global}
        onOpenChange={(open) => !open && setEditingEntry(null)}
        onSaved={refreshRoutesOnly}
      />

      <CakeMediaPicker
        open={mediaOpen}
        onOpenChange={setMediaOpen}
        onSelect={(url) => {
          setGlobal((prev) => ({ ...prev, defaultOgImage: url }));
          setMediaOpen(false);
        }}
      />

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset SEO?</DialogTitle>
            <DialogDescription>
              Replace global defaults and all page SEO routes with the demo seed data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReset}>
              Reset defaults
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
