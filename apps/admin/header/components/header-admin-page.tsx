"use client";

import { useMemo, useState } from "react";
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
import type {
  HeaderNavItem,
  HeaderSettings,
  MegaMenuGroup,
  MegaMenuLinkItem,
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
        heading: "New group",
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
      { id: `lnk-${Date.now()}`, label: "New link", href: "/store/collections" },
    ]);
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
                <p className="text-xs text-muted-foreground">Search icon on desktop navbar.</p>
              </div>
              <Switch
                checked={settings.showSearch}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, showSearch: checked }))
                }
                aria-label="Show search"
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Show CTA button</p>
                <p className="text-xs text-muted-foreground">Order inquiry button on desktop.</p>
              </div>
              <Switch
                checked={settings.showCta}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, showCta: checked }))
                }
                aria-label="Show CTA button"
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
                  <Input
                    value={item.href}
                    onChange={(e) => updateNav(item.id, { href: e.target.value })}
                    placeholder="/store/..."
                    aria-label={`Nav link ${index + 1} URL`}
                  />

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

                        {group.links.map((link, linkIndex) => (
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
                        ))}

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => addLink(item.id, group.id)}
                        >
                          <Plus className="size-3.5" />
                          Add link
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

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
