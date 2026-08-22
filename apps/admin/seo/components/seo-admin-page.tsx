"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  FileText,
  Globe,
  Link2,
  MoreHorizontal,
  Pencil,
  Search,
  ShieldOff,
} from "lucide-react";
import { toast } from "sonner";
import { reportWrite } from "@/apps/admin/lib/report-write";
import { AdminSelect, adminTextareaClassName } from "@/apps/admin/products/components/admin-field";
import { MediaPicker } from "@/apps/admin/products/components/media-picker";
import {
  FilterPanel,
  FilterPanelSearch,
  FilterPanelToolbar,
} from "@/apps/admin/components/filter-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { DashboardStatCard } from "@/apps/admin/dashboard/components/dashboard-stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatRelativeTime } from "@/utils/format";
import type { GlobalSeoSettings, SeoRouteEntry } from "@/types/seo";
import { adminShell } from "@/apps/admin/components";
import { SettingsSectionShell } from "@/apps/admin/settings/components/settings-section-shell";
import { useHydratedForm } from "@/features/settings/lib/use-hydrated-form";
import { seoHydration } from "@/features/site-layout/lib/site-layout-api";
import { ensureSeoHydrated } from "@/features/site-layout/lib/site-layout-hydration";
import { SettingsHydrationNotice } from "@/apps/admin/settings/components/settings-field-error";
import {
  loadSeoStore,
  resetSeoStore,
  saveGlobalSeo,
  SEO_UPDATED_EVENT,
} from "@/features/seo/lib/seo-repository";
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
} from "@/features/seo/lib/seo-metadata";
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

/** The global SEO form: the settings, plus the comma-separated keyword box. */
interface SeoGlobalForm {
  global: GlobalSeoSettings;
  keywords: string;
}

function readGlobalForm(): SeoGlobalForm {
  const { global } = loadSeoStore();
  return { global, keywords: global.defaultKeywords.join(", ") };
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
  // A real hydration state, not a "has this component mounted" flag.
  //
  // `mounted` flipped true in the same synchronous tick as the localStorage
  // read, so the form was interactive over `loadSeoStore()` — which SEEDS the
  // demo store when the key is absent. One edit made the form dirty, the
  // arriving server values were then skipped by the guard below (correctly,
  // to protect the edit), and Save pushed the demo canonical domain, demo
  // site name and demo titles over the real ones — whole-store replace.
  // The global form goes through the shared hydrated form; the ROUTES below
  // are display-only and keep their own state.
  //
  // The keyword box is part of the value rather than a sibling state: it is a
  // comma-separated view of `defaultKeywords`, and holding it separately is
  // what made the dirty check a hand-rolled composite that then had to be
  // mirrored into a ref for the resync listener to read.
  const {
    value: form,
    isDirty,
    hydration,
    canSave,
    edit,
    discard,
    runWrite,
  } = useHydratedForm<SeoGlobalForm>({
    read: readGlobalForm,
    fallback: { global: PLACEHOLDER_GLOBAL, keywords: "" },
    gate: seoHydration,
    ensureHydrated: ensureSeoHydrated,
    updatedEvent: SEO_UPDATED_EVENT,
  });
  const global = form.global;
  const keywordsInput = form.keywords;
  const [seoRoutes, setSeoRoutes] = useState<SeoRouteEntry[]>([]);
  const [filters, setFilters] = useState<SeoRouteListFilters>(defaultSeoRouteFilters);
  const [editingEntry, setEditingEntry] = useState<SeoRouteEntry | null>(null);
  const [mediaOpen, setMediaOpen] = useState(false);

  /** Edits the settings half of the form, leaving the keyword box alone. */
  function editGlobal(update: (prev: GlobalSeoSettings) => GlobalSeoSettings) {
    edit((prev) => ({ ...prev, global: update(prev.global) }));
  }

  /** The keyword box is free text until save, when it is parsed into a list. */
  function setKeywords(keywords: string) {
    edit((prev) => ({ ...prev, keywords }));
  }

  function refreshRoutes() {
    setSeoRoutes(loadSeoStore().routes);
  }

  useEffect(() => {
    // Routes only. The global form resyncs through the hook, which already
    // listens on this event and already refuses to clobber an edit in
    // progress — the ref-mirrored dirty check this replaces existed to do
    // exactly that by hand.
    refreshRoutes();
    window.addEventListener(SEO_UPDATED_EVENT, refreshRoutes);
    return () => window.removeEventListener(SEO_UPDATED_EVENT, refreshRoutes);
  }, []);

  const overview = useMemo(
    () => (hydration === "pending" ? EMPTY_OVERVIEW : getSeoOverview(seoRoutes, global)),
    [hydration, seoRoutes, global]
  );

  const filtered = useMemo(
    () => filterSeoRouteList(seoRoutes, filters),
    [seoRoutes, filters]
  );

  const filtersActive =
    filters.search.trim() !== "" ||
    filters.status !== "all" ||
    filters.sort !== "label";

  function updateFilters(patch: Partial<SeoRouteListFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  async function handleSaveGlobal() {
    if (!global.siteName.trim() || !global.canonicalBaseUrl.trim()) {
      toast.error("Site name and canonical base URL are required");
      return;
    }
    if (!isValidJson(global.organizationSchemaJson ?? "")) {
      toast.error("Organization schema must be valid JSON");
      return;
    }

    if (!canSave) return;
    await runWrite(async () => {
      const { value: saved, persisted } = await saveGlobalSeo({
        ...global,
        defaultKeywords: parseKeywords(keywordsInput),
      });
      // Only mark clean when the SERVER has it. These tags are what search
      // engines read from the rendered pages, built from the server copy.
      return {
        value: { global: saved, keywords: saved.defaultKeywords.join(", ") },
        accepted: reportWrite(persisted, "Global SEO settings saved"),
      };
    });
  }

  function handleDiscard() {
    discard();
    toast.message("Discarded unsaved changes");
  }

  async function handleReset() {
    if (!canSave) return;
    await runWrite(async () => {
      const { persisted } = await resetSeoStore();
      refreshRoutes();
      return {
        value: readGlobalForm(),
        accepted: reportWrite(persisted, "SEO settings reset to defaults"),
      };
    });
  }

  return (
    <SettingsSectionShell
      title="SEO"
      description="Manage meta tags, Open Graph, and page-level SEO"
      isDirty={isDirty}
      // Behind the skeleton until the SERVER's copy has landed. Gating only the
      // Save button leaves the gap open: the admin edits the seeded canonical
      // domain, the arriving values are skipped because the form is dirty, and
      // Save unlocks over it.
      mounted={hydration !== "pending"}
      onSave={handleSaveGlobal}
      onDiscard={handleDiscard}
      onReset={handleReset}
      // Reset sits outside the gated form, so without this it is clickable
      // before hydration and its handler simply returns.
      resetDisabled={!canSave}
      saveDisabled={
        !isValidJson(global.organizationSchemaJson ?? "") || hydration !== "ready"
      }
      saveLabel="Save global SEO"
      resetTitle="Reset SEO?"
      resetDescription="Replace global defaults and all page SEO routes with the demo seed data."
    >
      <SettingsHydrationNotice hydration={hydration} />
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

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
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
                  editGlobal((prev) => ({ ...prev, siteName: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title-suffix">Title suffix</Label>
              <Input
                id="title-suffix"
                value={global.titleSuffix}
                onChange={(e) =>
                  editGlobal((prev) => ({ ...prev, titleSuffix: e.target.value }))
                }
                placeholder="| Your Bakery"
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
                editGlobal((prev) => ({ ...prev, defaultDescription: e.target.value }))
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
                  editGlobal((prev) => ({ ...prev, canonicalBaseUrl: e.target.value }))
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
                  editGlobal((prev) => ({ ...prev, defaultOgImage: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default-keywords">Default keywords</Label>
            <Input
              id="default-keywords"
              value={keywordsInput}
              onChange={(e) => setKeywords(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="google-verification">Google site verification</Label>
              <Input
                id="google-verification"
                value={global.googleSiteVerification ?? ""}
                onChange={(e) =>
                  editGlobal((prev) => ({
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
                  editGlobal((prev) => ({
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
                  editGlobal((prev) => ({ ...prev, twitterSite: e.target.value }))
                }
                placeholder="@yourbakery"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twitter-creator">Twitter @creator</Label>
              <Input
                id="twitter-creator"
                value={global.twitterCreator ?? ""}
                onChange={(e) =>
                  editGlobal((prev) => ({ ...prev, twitterCreator: e.target.value }))
                }
                placeholder="@yourbakery"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twitter-card">Default Twitter card</Label>
              <AdminSelect
                id="twitter-card"
                value={global.defaultTwitterCard}
                onChange={(e) =>
                  editGlobal((prev) => ({
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
                editGlobal((prev) => ({
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
            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
              <AdminSelect
                value={filters.status}
                aria-label="SEO status"
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
                aria-label="Sort order"
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
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
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

      <SeoRouteEditDialog
        open={Boolean(editingEntry)}
        entry={editingEntry}
        global={global}
        onOpenChange={(open) => !open && setEditingEntry(null)}
        onSaved={refreshRoutes}
      />

      <MediaPicker
        open={mediaOpen}
        onOpenChange={setMediaOpen}
        onSelect={(url) => {
          editGlobal((prev) => ({ ...prev, defaultOgImage: url }));
          setMediaOpen(false);
        }}
      />
    </SettingsSectionShell>
  );
}
