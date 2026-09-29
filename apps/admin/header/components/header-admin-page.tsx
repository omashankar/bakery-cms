"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Link2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { reportWrite } from "@/apps/admin/lib/report-write";
import { EmptyState } from "@/components/shared/empty-state";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NAV_ICONS } from "@/config/nav-icons";
import { Checkbox } from "@/components/ui/checkbox";
import { useBusinessLabels } from "@/hooks/use-business-labels";
import {
  CATALOG_UPDATED_EVENT,
  getCategories,
  getCollections,
  getOccasions,
} from "@/features/catalog/lib/catalog-repository";
import {
  CATALOG_HYDRATION_EVENT,
  catalogHydrationStatus,
} from "@/features/catalog/lib/catalog-api";
import { offeredAxes } from "@/features/catalog/lib/catalog-utils";
import { routeForAxis } from "@/features/site-layout/lib/menu-links";
import type { MenuAxes } from "@/features/site-layout/lib/menu-links";
import type {
  HeaderNavItem,
  HeaderSettings,
  MegaMenuGroup,
  MegaMenuLinkItem,
  MenuLinkRef,
} from "@/types/site-layout";
import { SettingsSectionShell } from "@/apps/admin/settings/components/settings-section-shell";
import { useHydratedForm } from "@/features/settings/lib/use-hydrated-form";
import { siteLayoutHydration } from "@/features/site-layout/lib/site-layout-api";
import { ensureSiteLayoutHydrated } from "@/components/shared/site-layout-server-sync";
import { SettingsHydrationNotice } from "@/apps/admin/settings/components/settings-field-error";
import {
  loadHeaderSettings,
  resetHeaderSettings,
  saveHeaderSettings,
} from "@/features/site-layout/lib/header-repository";
import {
  defaultHeaderSettings,
  getHeaderOverview,
  reorderHeaderNav,
  type HeaderOverview,
} from "@/features/site-layout/lib/header-utils";

const EMPTY_OVERVIEW: HeaderOverview = {
  totalLinks: 0,
  visibleLinks: 0,
  hiddenLinks: 0,
  searchEnabled: false,
  ctaEnabled: false,
};

/**
 * A LINK ID THAT SURVIVES A LOOP.
 *
 * `Date.now()` was enough while links were added one at a time and is not
 * enough now: the picker adds one per ticked box in a single loop, inside one
 * millisecond. Duplicate ids are a React key collision and a delete button
 * that removes the wrong row.
 *
 * Outside the component deliberately — a clock and a die are impure, and
 * inside a component body `react-hooks/purity` is right to say so. The
 * fallback is for a browser without `crypto.randomUUID`, which is an insecure
 * context rather than an old browser; the counter keeps it unique within the
 * page even when the clock does not move.
 */
let linksMade = 0;

function newLinkId(): string {
  linksMade += 1;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `lnk-${crypto.randomUUID()}`;
  }
  return `lnk-${Date.now()}-${linksMade}`;
}

export function HeaderAdminPage() {
  // The shared hydrated form. This page hand-rolled it: a one-shot `[]`-dep
  // effect read localStorage on mount and declared the form ready in the same
  // tick. `SiteLayoutServerSync` reads the server's copy from a root-layout
  // effect, so on a hard load that read is still in flight and
  // `loadHeaderSettings()` answers with the DEMO NAVIGATION — and saving is a
  // replace-all, so one edit replaced the shop's entire storefront menu, its
  // logo badge, its search toggle and its CTA with the demo set.
  const {
    value: settings,
    isDirty,
    hydration,
    isWriting,
    canSave,
    edit: setSettings,
    discard,
    runWrite,
  } = useHydratedForm<HeaderSettings>({
    read: loadHeaderSettings,
    fallback: defaultHeaderSettings,
    gate: siteLayoutHydration,
    ensureHydrated: ensureSiteLayoutHydrated,
  });
  const [removeTarget, setRemoveTarget] = useState<HeaderNavItem | null>(null);

  /**
   * THE THREE LISTS, AND WHY THEY START EMPTY.
   *
   * This is a `"use client"` page and it is server-rendered first.
   * `loadCatalogStore` answers `defaultCatalogStore` when there is no
   * `window`, so seeding this state from the getters would put the SHIPPED
   * DEMO taxonomy in the HTML — and then swap it for the shop's own on the
   * first client render, which is a hydration mismatch and, worse, a moment
   * where the boxes a shop could tick are somebody else's categories.
   *
   * Empty on the server, empty on the first client render, filled on mount.
   * The picker stays disabled until the catalogue has actually arrived.
   */
  const [catalogLists, setCatalogLists] = useState<{
    categories: ReturnType<typeof getCategories>;
    occasions: ReturnType<typeof getOccasions>;
    collections: ReturnType<typeof getCollections>;
  }>({ categories: [], occasions: [], collections: [] });
  const [catalogReady, setCatalogReady] = useState(false);

  useEffect(() => {
    const sync = () => {
      setCatalogLists({
        categories: getCategories(),
        occasions: getOccasions(),
        collections: getCollections(),
      });
      setCatalogReady(catalogHydrationStatus() === "ready");
    };
    sync();
    window.addEventListener(CATALOG_UPDATED_EVENT, sync);
    window.addEventListener(CATALOG_HYDRATION_EVENT, sync);
    return () => {
      window.removeEventListener(CATALOG_UPDATED_EVENT, sync);
      window.removeEventListener(CATALOG_HYDRATION_EVENT, sync);
    };
  }, []);

  /**
   * WHAT THE SHOP MAY PICK — the storefront's own rule, not this screen's.
   *
   * A switched-off row, an empty group, a duplicate slug and a category whose
   * address a collection holds are all dropped by the server. Offering any of
   * them here would hand the shop a link that saves, reads as saved, and
   * never appears on the site. One rule, both ends.
   */
  const offered = useMemo(
    () =>
      offeredAxes({
        categories: catalogLists.categories,
        occasions: catalogLists.occasions,
        collections: catalogLists.collections,
      }),
    [catalogLists],
  );

  /** The same three lists the server resolves against. */
  const menuAxes: MenuAxes = useMemo(
    () => ({
      category: offered.categories,
      occasion: offered.occasions,
      collection: offered.collections,
    }),
    [offered],
  );

  /** The shop's own nouns for the three headings, never typed here. */
  const labels = useBusinessLabels();

  /** Which group the picker is open over, and what has been ticked in it. */
  const [pickTarget, setPickTarget] = useState<{ navId: string; groupId: string } | null>(null);
  const [picked, setPicked] = useState<MenuLinkRef[]>([]);

  function togglePick(ref: MenuLinkRef) {
    setPicked((prev) =>
      prev.some((entry) => entry.axis === ref.axis && entry.id === ref.id)
        ? prev.filter((entry) => !(entry.axis === ref.axis && entry.id === ref.id))
        : [...prev, ref],
    );
  }

  function closePicker() {
    setPickTarget(null);
    setPicked([]);
  }

  const overview = useMemo(
    () => (hydration === "pending" ? EMPTY_OVERVIEW : getHeaderOverview(settings)),
    [hydration, settings]
  );

  const sortedNav = useMemo(
    () => [...settings.nav].sort((a, b) => a.sortOrder - b.sortOrder),
    [settings.nav]
  );

  function updateNav(id: string, patch: Partial<HeaderNavItem>) {
    setSettings((prev) => ({
      ...prev,
      nav: prev.nav.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  /**
   * The thin row above the main bar.
   *
   * Its own small writer set rather than a shared one parameterised by which
   * list to touch: three short functions read more plainly than one that
   * takes a key, and this screen already has that shape for `nav`.
   */
  function addUtilityItem() {
    setSettings((prev) => ({
      ...prev,
      utilityNav: [
        ...(prev.utilityNav ?? []),
        {
          id: `util-${Date.now()}`,
          label: "New link",
          href: "/store",
          isVisible: true,
          sortOrder: (prev.utilityNav ?? []).length + 1,
        },
      ],
    }));
  }

  function updateUtility(id: string, patch: Partial<HeaderNavItem>) {
    setSettings((prev) => ({
      ...prev,
      utilityNav: (prev.utilityNav ?? []).map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  }

  function removeUtility(id: string) {
    setSettings((prev) => ({
      ...prev,
      utilityNav: (prev.utilityNav ?? [])
        .filter((item) => item.id !== id)
        .map((item, index) => ({ ...item, sortOrder: index + 1 })),
    }));
  }

  function addNavItem() {
    setSettings((prev) => ({
      ...prev,
      nav: [
        ...prev.nav,
        {
          id: `nav-${Date.now()}`,
          label: "New link",
          href: "/store",
          isVisible: true,
          sortOrder: prev.nav.length + 1,
        },
      ],
    }));
  }

  /**
   * Every mega-menu write goes through here.
   *
   * One helper rather than six, because each one is the same shape: replace
   * this row's `menu` with a new array. Written functionally so two quick
   * edits cannot capture a stale copy and drop the first — the same reason
   * the product form's category toggles are.
   */
  function updateMenu(
    navId: string,
    change: (groups: MegaMenuGroup[]) => MegaMenuGroup[],
  ) {
    setSettings((prev) => ({
      ...prev,
      nav: prev.nav.map((item) =>
        item.id === navId ? { ...item, menu: change(item.menu ?? []) } : item,
      ),
    }));
  }

  function addGroup(navId: string) {
    updateMenu(navId, (groups) => [
      ...groups,
      {
        id: `grp-${Date.now()}`,
        /*
          EMPTY, not "New group". A heading is a column name in a live panel
          and this software may not write one on the shop's behalf — the same
          rule that keeps every other new field blank. The renderer draws no
          heading at all when this is blank, so an unnamed column reads as a
          plain list rather than as something half-finished.
        */
        heading: "",
        sortOrder: groups.length + 1,
        isVisible: true,
        links: [],
      },
    ]);
  }

  function patchGroup(navId: string, groupId: string, patch: Partial<MegaMenuGroup>) {
    updateMenu(navId, (groups) =>
      groups.map((group) => (group.id === groupId ? { ...group, ...patch } : group)),
    );
  }

  function removeGroup(navId: string, groupId: string) {
    updateMenu(navId, (groups) =>
      groups
        .filter((group) => group.id !== groupId)
        .map((group, index) => ({ ...group, sortOrder: index + 1 })),
    );
  }

  function addLink(navId: string, groupId: string) {
    patchGroupLinks(navId, groupId, (links) => [
      ...links,
      { id: newLinkId(), label: "New link", href: "/store/collections" },
    ]);
  }

  /** The row behind a picked link, or undefined once the shop deletes it. */
  function rowFor(ref: MenuLinkRef) {
    return menuAxes[ref.axis].find((row) => row.id === ref.id);
  }

  /**
   * Every ticked box becomes a link that POINTS at its row.
   *
   * `label` and `href` are written too, and they are a record rather than the
   * source of truth: the server rebuilds both from the live row on every
   * render. They are what lets an unresolved link still say which row it
   * meant.
   */
  function addPickedLinks() {
    if (!pickTarget) return;
    const { navId, groupId } = pickTarget;
    const additions = picked.flatMap((ref) => {
      const row = rowFor(ref);
      if (!row) return [];
      return [
        {
          id: newLinkId(),
          label: row.name,
          href: routeForAxis(ref.axis, row.slug),
          ref: { axis: ref.axis, id: ref.id },
        },
      ];
    });
    if (additions.length > 0) {
      patchGroupLinks(navId, groupId, (links) => [...links, ...additions]);
      toast.message(
        additions.length === 1 ? "1 link added" : `${additions.length} links added`,
      );
    }
    closePicker();
  }

  /**
   * TURN A PICKED LINK BACK INTO A TYPED ONE.
   *
   * The escape hatch, and the reason the picked row shows no input boxes: a
   * box the server overwrites on every render is a lie. A shop that wants its
   * own wording drops the pointer and types, knowing it has given up the
   * rename and the delete following along.
   */
  function unlinkFromCatalog(navId: string, groupId: string, linkId: string) {
    patchGroupLinks(navId, groupId, (links) =>
      links.map((entry) => {
        if (entry.id !== linkId) return entry;
        const { ref: _dropped, ...rest } = entry;
        return rest;
      }),
    );
  }

  function patchGroupLinks(
    navId: string,
    groupId: string,
    change: (links: MegaMenuLinkItem[]) => MegaMenuLinkItem[],
  ) {
    updateMenu(navId, (groups) =>
      groups.map((group) =>
        group.id === groupId ? { ...group, links: change(group.links) } : group,
      ),
    );
  }

  function moveNav(id: string, direction: "up" | "down") {
    setSettings((prev) => ({
      ...prev,
      nav: reorderHeaderNav(prev.nav, id, direction),
    }));
  }

  function confirmRemoveNav() {
    if (!removeTarget) return;
    setSettings((prev) => ({
      ...prev,
      nav: prev.nav
        .filter((item) => item.id !== removeTarget.id)
        .map((item, index) => ({ ...item, sortOrder: index + 1 })),
    }));
    setRemoveTarget(null);
    toast.message("Navigation link removed");
  }

  async function handleSave() {
    if (!settings.logoLetter.trim()) {
      toast.error("Logo letter is required");
      return;
    }
    if (settings.nav.some((item) => !item.label.trim() || !item.href.trim())) {
      toast.error("Every nav link needs a label and URL");
      return;
    }
    if (!canSave) return;
    await runWrite(async () => {
      const { value: next, persisted } = await saveHeaderSettings(settings);
      // Only mark clean when the SERVER has it — the dirty flag is what keeps
      // the Save button enabled, so adopting a rejected value removes the retry.
      return { value: next, accepted: reportWrite(persisted, "Header settings saved", {
        failure: "Header was not saved — the server rejected it",
      }) };
    });
  }

  function handleDiscard() {
    discard();
    toast.message("Discarded unsaved changes");
  }

  async function handleReset() {
    // Reset lives in the page header, outside the gated form, so it is
    // reachable before hydration. It returned in silence: the admin confirmed
    // a destructive dialog, it closed, and nothing happened or was said.
    if (!canSave) {
      toast.error("Saved header hasn't loaded yet", {
        description: "Reset is unavailable until this page can reach the server.",
      });
      return;
    }
    await runWrite(async () => {
      const { value: next, persisted } = await resetHeaderSettings();
      return {
        value: next,
        accepted: reportWrite(persisted, "Header reset to defaults", {
          // The store rolls the local change back, so the default copy
          // ("saved on this device only") would be wrong: it is nowhere.
          failure: "Header was not reset — the server rejected it",
        }),
      };
    });
  }

  return (
    <SettingsSectionShell
      title="Header"
      description={
        hydration === "ready"
          ? `${overview.visibleLinks} visible links · search ${overview.searchEnabled ? "on" : "off"} · CTA ${overview.ctaEnabled ? "on" : "off"}`
          : "Configure storefront top navigation, search, and CTA"
      }
      isDirty={isDirty}
      // Behind the skeleton until the SERVER's copy has landed. Gating only the
      // Save button leaves the gap open: the admin edits the demo nav, the
      // arriving values are skipped because the form is dirty, and Save unlocks
      // over it.
      mounted={hydration !== "pending"}
      isSaving={isWriting}
      saveDisabled={!canSave}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onReset={handleReset}
      // Reset sits outside the gated form, so without this it is clickable
      // before hydration and its handler simply returns.
      resetDisabled={!canSave}
      resetTitle="Reset header?"
      resetDescription="Replace current header settings with the default demo navigation."
    >
      <SettingsHydrationNotice hydration={hydration} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Branding &amp; actions</CardTitle>
            <CardDescription>Logo badge and primary CTA shown in the navbar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="logo-letter">Logo letter</Label>
              <Input
                id="logo-letter"
                maxLength={2}
                value={settings.logoLetter}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, logoLetter: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Show search</p>
                {/*
                  It said "Search icon on desktop navbar" for a control that
                  is a search BOX, from tablet width up, with an icon on
                  phones. Three things wrong in seven words, on the screen
                  whose job is to explain the switch.
                */}
                <p className="text-xs text-muted-foreground">
                  Search box in the storefront header.
                </p>
              </div>
              <Switch
                checked={settings.showSearch}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, showSearch: checked }))
                }
                aria-label="Show search"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="search-placeholder">Search placeholder</Label>
              <Input
                id="search-placeholder"
                value={settings.searchPlaceholder ?? ""}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, searchPlaceholder: e.target.value }))
                }
                disabled={!settings.showSearch}
                /*
                  DELIBERATELY NOT AN EXAMPLE. The reference header's line
                  reads "Search 5000+ flowers, cakes, gifts etc" — a claim
                  about the size of a catalogue that only this shop knows,
                  and prefilling anything like it here is this software
                  putting a number in the shop's mouth. Blank falls back to
                  the shop's own plural noun.
                */
                placeholder="Optional"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use your own product wording.
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Show CTA button</p>
                <p className="text-xs text-muted-foreground">
                  A button beside the cart, for whatever you want asked first.
                </p>
              </div>
              <Switch
                checked={settings.showCta}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, showCta: checked }))
                }
                aria-label="Show CTA button"
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Show promo strip</p>
                <p className="text-xs text-muted-foreground">
                  Your active banners, above the header. They also appear in the
                  homepage&rsquo;s Promo Banner section.
                </p>
              </div>
              <Switch
                checked={settings.showBannerStrip ?? true}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, showBannerStrip: checked }))
                }
                aria-label="Show promo strip"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cta-label">CTA label</Label>
              <Input
                id="cta-label"
                value={settings.ctaLabel}
                onChange={(e) => setSettings((prev) => ({ ...prev, ctaLabel: e.target.value }))}
                disabled={!settings.showCta}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cta-href">CTA link</Label>
              <Input
                id="cta-href"
                value={settings.ctaHref}
                onChange={(e) => setSettings((prev) => ({ ...prev, ctaHref: e.target.value }))}
                disabled={!settings.showCta}
                placeholder="/store/contact"
              />
            </div>
          </CardContent>
        </Card>

        {/*
          THE TOP ROW — Help, Track Order, whatever the shop keeps within
          reach. Empty by default, and an empty list renders no row at all.
        */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base">Top row</CardTitle>
              <CardDescription>
                The thin row above your logo. Leave it empty and it does not appear.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={addUtilityItem}
              className="w-full sm:w-auto"
            >
              <Plus className="size-4" />
              Add link
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch
                checked={Boolean(settings.showCurrencyNote)}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, showCurrencyNote: checked }))
                }
                aria-label="Show the currency"
              />
              Show which currency your prices are in
            </label>
            {(settings.utilityNav ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No links yet — the row is hidden.
              </p>
            ) : (
              (settings.utilityNav ?? []).map((item, index) => (
                <div key={item.id} className="flex items-center gap-2">
                  <Input
                    value={item.label}
                    onChange={(e) => updateUtility(item.id, { label: e.target.value })}
                    placeholder="Label"
                    aria-label={`Top row link ${index + 1} label`}
                  />
                  <Input
                    value={item.href}
                    onChange={(e) => updateUtility(item.id, { href: e.target.value })}
                    placeholder="/store/..."
                    aria-label={`Top row link ${index + 1} URL`}
                  />
                  <Switch
                    checked={item.isVisible}
                    onCheckedChange={(checked) =>
                      updateUtility(item.id, { isVisible: checked })
                    }
                    aria-label={`Show ${item.label || "link"}`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeUtility(item.id)}
                    aria-label={`Remove ${item.label || "link"}`}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base">Navigation links</CardTitle>
              <CardDescription>Links shown in the storefront header menu.</CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={addNavItem}
              className="w-full sm:w-auto"
            >
              <Plus className="size-4" />
              Add link
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedNav.length === 0 ? (
              <EmptyState
                icon={Link2}
                title="No navigation links"
                description="Add at least one link for the storefront header."
                action={
                  <Button variant="bakery" size="sm" onClick={addNavItem}>
                    <Plus className="size-4" />
                    Add link
                  </Button>
                }
              />
            ) : (
              sortedNav.map((item, index) => (
                <div key={item.id} className="space-y-2 rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={item.isVisible}
                        onCheckedChange={(checked) =>
                          updateNav(item.id, { isVisible: checked })
                        }
                        aria-label={`Show ${item.label || "link"} in header`}
                      />
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        {item.isVisible ? (
                          <>
                            <Eye className="size-3.5" />
                            Visible
                          </>
                        ) : (
                          <>
                            <EyeOff className="size-3.5" />
                            Hidden
                          </>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={index === 0}
                        onClick={() => moveNav(item.id, "up")}
                        aria-label="Move up"
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={index === sortedNav.length - 1}
                        onClick={() => moveNav(item.id, "down")}
                        aria-label="Move down"
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setRemoveTarget(item)}
                        disabled={settings.nav.length <= 1}
                        aria-label="Remove link"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <Input
                    value={item.label}
                    onChange={(e) => updateNav(item.id, { label: e.target.value })}
                    placeholder="Label"
                    aria-label={`Nav link ${index + 1} label`}
                  />
                  {/*
                    THE ROW'S OWN DESTINATION, PICKED OR TYPED.

                    The picker below takes the URLs out of a row's MENU and
                    left them in the row itself, which is the half that can
                    still 404: there is no /store/occasions index, and the
                    listing page parses only `category` and `q` — so a typed
                    `?occasion=birthday` is a silently unfiltered grid.

                    The box stays, because a row may point at a page, at the
                    contact form or off the site entirely. The dropdown is
                    for the three lists this software can address correctly.
                  */}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={item.href}
                      onChange={(e) => updateNav(item.id, { href: e.target.value })}
                      placeholder="/store/..."
                      aria-label={`Nav link ${index + 1} URL`}
                    />
                    <select
                      className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none"
                      value=""
                      disabled={!catalogReady}
                      onChange={(e) => {
                        if (e.target.value) updateNav(item.id, { href: e.target.value });
                      }}
                      aria-label={`Nav link ${index + 1} destination`}
                    >
                      <option value="">Or pick a page…</option>
                      {(
                        [
                          ["category", labels.categoryWordPlural, offered.categories],
                          ["occasion", labels.occasionWordPlural, offered.occasions],
                          ["collection", labels.collectionWordPlural, offered.collections],
                        ] as const
                      ).map(([axis, heading, rows]) =>
                        rows.length > 0 ? (
                          <optgroup key={axis} label={heading}>
                            {rows.map((row) => (
                              <option key={row.id} value={routeForAxis(axis, row.slug)}>
                                {row.name}
                              </option>
                            ))}
                          </optgroup>
                        ) : null,
                      )}
                    </select>
                  </div>

                  {/*
                    WHAT MAKES ONE ROW STAND OUT FROM THE OTHERS.

                    The reference header leads with EXPRESS in the brand
                    colour and ends with a promoted "2 Hour Delivery Gifts"
                    behind a divider, with a van icon. All four are the
                    shop's call — emphasis on everything is emphasis on
                    nothing, so which row gets it is not a developer's
                    decision.

                    Every field is optional and inert when unset, so a row
                    nobody touches renders exactly as it always has.
                  */}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={item.badge ?? ""}
                      onChange={(e) =>
                        updateNav(item.id, { badge: e.target.value || undefined })
                      }
                      placeholder="Badge (optional) — New, 2 Hour"
                      aria-label={`Nav link ${index + 1} badge`}
                    />
                    <select
                      className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none"
                      value={item.icon ?? ""}
                      onChange={(e) =>
                        updateNav(item.id, { icon: e.target.value || undefined })
                      }
                      aria-label={`Nav link ${index + 1} icon`}
                    >
                      <option value="">No icon</option>
                      {Object.keys(NAV_ICONS).map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={Boolean(item.highlight)}
                        onCheckedChange={(checked) =>
                          updateNav(item.id, { highlight: checked || undefined })
                        }
                        aria-label={`Highlight ${item.label || "link"}`}
                      />
                      Highlight in your brand colour
                    </label>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={Boolean(item.dividerBefore)}
                        onCheckedChange={(checked) =>
                          updateNav(item.id, { dividerBefore: checked || undefined })
                        }
                        aria-label={`Divider before ${item.label || "link"}`}
                      />
                      Separate it from the row before
                    </label>
                  </div>

                  {/*
                    THIS ROW'S OWN MEGA MENU.

                    A row with no groups stays a plain link — which is every
                    row today, and is why nothing changes for a shop that
                    never opens this. Add one group and the row becomes a
                    menu: its own headings, its own links, its own order.

                    The Collections row is the exception worth knowing: left
                    with no groups it keeps drawing the shop's categories and
                    occasions, as it always has. Adding groups here replaces
                    that with what you write.
                  */}
                  <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {(item.menu ?? []).length === 0
                          ? "Drop-down menu — none yet, so this is a plain link"
                          : `Drop-down menu — ${(item.menu ?? []).length} group${(item.menu ?? []).length === 1 ? "" : "s"}`}
                      </p>
                      <Button size="sm" variant="outline" onClick={() => addGroup(item.id)}>
                        <Plus className="size-3.5" />
                        Add group
                      </Button>
                    </div>

                    {(item.menu ?? []).map((group) => (
                      <div key={group.id} className="space-y-2 rounded-lg bg-muted/40 p-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={group.heading}
                            onChange={(e) =>
                              patchGroup(item.id, group.id, { heading: e.target.value })
                            }
                            placeholder="Group heading"
                            aria-label={`${item.label} group heading`}
                          />
                          <Switch
                            checked={group.isVisible}
                            onCheckedChange={(checked) =>
                              patchGroup(item.id, group.id, { isVisible: checked })
                            }
                            aria-label={`Show ${group.heading || "group"}`}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeGroup(item.id, group.id)}
                            aria-label={`Remove ${group.heading || "group"}`}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>

                        {group.links.map((link, linkIndex) => {
                          /*
                            A PICKED LINK HAS NO BOXES TO TYPE IN.

                            Its label and its address are rebuilt from the
                            live catalogue row on every render, so an input
                            here would be a box that silently discards what
                            is typed into it. What the shop gets instead is
                            what the link WILL say, and one button to give up
                            the pointer and type after all.
                          */
                          const ref = link.ref;
                          if (ref) {
                            const row = rowFor(ref);
                            return (
                              <div key={link.id} className="flex items-center gap-2">
                                <div className="flex min-w-0 flex-1 flex-col">
                                  <span className="truncate text-sm font-medium">
                                    {row ? row.name : link.label}
                                  </span>
                                  <span className="truncate text-xs text-muted-foreground">
                                    {row
                                      ? routeForAxis(ref.axis, row.slug)
                                      : "No longer in the catalog — this link is not shown on the site"}
                                  </span>
                                </div>
                                <Input
                                  size={1}
                                  className="max-w-[7rem]"
                                  value={link.badge ?? ""}
                                  onChange={(e) =>
                                    patchGroupLinks(item.id, group.id, (links) =>
                                      links.map((entry) =>
                                        entry.id === link.id
                                          ? { ...entry, badge: e.target.value || undefined }
                                          : entry,
                                      ),
                                    )
                                  }
                                  placeholder="Badge"
                                  aria-label={`${group.heading} catalog link ${linkIndex + 1} badge`}
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => unlinkFromCatalog(item.id, group.id, link.id)}
                                >
                                  Type it instead
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() =>
                                    patchGroupLinks(item.id, group.id, (links) =>
                                      links.filter((entry) => entry.id !== link.id),
                                    )
                                  }
                                  aria-label={`Remove ${row ? row.name : link.label || "link"}`}
                                >
                                  <Trash2 className="size-4 text-destructive" />
                                </Button>
                              </div>
                            );
                          }
                          return (
                          <div key={link.id} className="flex items-center gap-2">
                            <Input
                              value={link.label}
                              onChange={(e) =>
                                patchGroupLinks(item.id, group.id, (links) =>
                                  links.map((entry) =>
                                    entry.id === link.id
                                      ? { ...entry, label: e.target.value }
                                      : entry,
                                  ),
                                )
                              }
                              placeholder="Label"
                              aria-label={`${group.heading} link ${linkIndex + 1} label`}
                            />
                            <Input
                              value={link.href}
                              onChange={(e) =>
                                patchGroupLinks(item.id, group.id, (links) =>
                                  links.map((entry) =>
                                    entry.id === link.id
                                      ? { ...entry, href: e.target.value }
                                      : entry,
                                  ),
                                )
                              }
                              placeholder="/store/collections/..."
                              aria-label={`${group.heading} link ${linkIndex + 1} URL`}
                            />
                            {/*
                              THE WORD BESIDE A LINK.

                              `badge` has existed on a menu link in the type,
                              the validator and BOTH renderers since the menu
                              did, with no box anywhere to type it in — a field
                              only a hand-edited document could ever set. The
                              four layers were all there; the fifth nobody
                              counts is a control.

                              This is also the whole of a reference header's
                              little coloured tick, done in a way that carries
                              its own meaning: a mark cannot say WHY it is
                              there and a screen reader never receives it,
                              while a word the shop chose reaches everybody,
                              in the shop's own brand colour.

                              `size={1}` on this repo's recorded lesson about
                              inputs in a shared row, and a max width so the
                              two fields that matter keep theirs.
                            */}
                            <Input
                              size={1}
                              className="max-w-[7rem]"
                              value={link.badge ?? ""}
                              onChange={(e) =>
                                patchGroupLinks(item.id, group.id, (links) =>
                                  links.map((entry) =>
                                    entry.id === link.id
                                      ? { ...entry, badge: e.target.value || undefined }
                                      : entry,
                                  ),
                                )
                              }
                              placeholder="Badge"
                              aria-label={`${group.heading} link ${linkIndex + 1} badge`}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                patchGroupLinks(item.id, group.id, (links) =>
                                  links.filter((entry) => entry.id !== link.id),
                                )
                              }
                              aria-label={`Remove ${link.label || "link"}`}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                          );
                        })}

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => addLink(item.id, group.id)}
                          >
                            <Plus className="size-3.5" />
                            Add link
                          </Button>
                          {/*
                            THE DOOR THIS MENU NEVER HAD.

                            Every piece of a per-row menu has been here since
                            it shipped — the type, the validator, both
                            renderers — and it is empty on every row of every
                            shop, because filling it meant hand-typing a label
                            and an address per link. Ticking boxes is the
                            difference between a feature and a feature nobody
                            uses.

                            Disabled until the catalogue has actually
                            arrived: before that the only rows to offer are
                            the shipped demo ones, and a link picked from
                            those points at a row this shop does not have.
                          */}
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!catalogReady}
                            onClick={() => {
                              setPicked([]);
                              setPickTarget({ navId: item.id, groupId: group.id });
                            }}
                          >
                            <Link2 className="size-3.5" />
                            Pick from catalog
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/*
        ONE DIALOG FOR ALL THREE AXES, headed in the shop's own nouns.

        A shop that files under Brands reads Brands here, because the heading
        comes from the label system rather than from this file. And only rows
        the storefront will actually offer are listed — the alternative is a
        tick that saves, reads as saved, and never appears on the site.
      */}
      <Dialog open={Boolean(pickTarget)} onOpenChange={(open) => !open && closePicker()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Pick from catalog</DialogTitle>
            <DialogDescription>
              A picked link follows the catalog: rename a row and the menu renames
              with it, remove one and the link goes. Only rows the shop is showing
              are listed here.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-4 overflow-y-auto">
            {(
              [
                ["category", labels.categoryWordPlural, offered.categories],
                ["occasion", labels.occasionWordPlural, offered.occasions],
                ["collection", labels.collectionWordPlural, offered.collections],
              ] as const
            ).map(([axis, heading, rows]) =>
              rows.length === 0 ? null : (
                <div key={axis} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {heading}
                  </p>
                  {rows.map((row) => (
                    <Label
                      key={row.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm font-normal"
                    >
                      <Checkbox
                        checked={picked.some(
                          (entry) => entry.axis === axis && entry.id === row.id,
                        )}
                        onCheckedChange={() => togglePick({ axis, id: row.id })}
                      />
                      <span className="min-w-0 flex-1 truncate">{row.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {routeForAxis(axis, row.slug)}
                      </span>
                    </Label>
                  ))}
                </div>
              ),
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={closePicker}>
              Cancel
            </Button>
            <Button onClick={addPickedLinks} disabled={picked.length === 0}>
              {picked.length === 1 ? "Add 1 link" : `Add ${picked.length} links`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove link?</DialogTitle>
            <DialogDescription>
              Remove &ldquo;{removeTarget?.label ?? "this link"}&rdquo; from the header
              navigation? Save to apply permanently.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmRemoveNav}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsSectionShell>
  );
}
