"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Link2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import type { HeaderNavItem, HeaderSettings } from "@/types/site-layout";
import { SettingsSectionShell } from "@/features/admin/settings/components/settings-section-shell";
import {
  loadHeaderSettings,
  resetHeaderSettings,
  saveHeaderSettings,
} from "../lib/header-repository";
import {
  defaultHeaderSettings,
  getHeaderOverview,
  reorderHeaderNav,
  type HeaderOverview,
} from "../lib/header-utils";

const EMPTY_OVERVIEW: HeaderOverview = {
  totalLinks: 0,
  visibleLinks: 0,
  hiddenLinks: 0,
  searchEnabled: false,
  ctaEnabled: false,
};

export function HeaderAdminPage() {
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<HeaderSettings>(defaultHeaderSettings);
  const [saved, setSaved] = useState<HeaderSettings>(defaultHeaderSettings);
  const [removeTarget, setRemoveTarget] = useState<HeaderNavItem | null>(null);

  useEffect(() => {
    const loaded = loadHeaderSettings();
    setSettings(loaded);
    setSaved(loaded);
    setMounted(true);
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(saved),
    [settings, saved]
  );

  const overview = useMemo(
    () => (mounted ? getHeaderOverview(settings) : EMPTY_OVERVIEW),
    [mounted, settings]
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

  function handleSave() {
    if (!settings.logoLetter.trim()) {
      toast.error("Logo letter is required");
      return;
    }
    if (settings.nav.some((item) => !item.label.trim() || !item.href.trim())) {
      toast.error("Every nav link needs a label and URL");
      return;
    }
    const next = saveHeaderSettings(settings);
    setSettings(next);
    setSaved(next);
    toast.success("Header settings saved");
  }

  function handleDiscard() {
    setSettings(saved);
    toast.message("Discarded unsaved changes");
  }

  function handleReset() {
    const next = resetHeaderSettings();
    setSettings(next);
    setSaved(next);
    toast.success("Header reset to defaults");
  }

  return (
    <SettingsSectionShell
      title="Header"
      description={
        mounted
          ? `${overview.visibleLinks} visible links · search ${overview.searchEnabled ? "on" : "off"} · CTA ${overview.ctaEnabled ? "on" : "off"}`
          : "Configure storefront top navigation, search, and CTA"
      }
      isDirty={isDirty}
      mounted={mounted}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onReset={handleReset}
      resetTitle="Reset header?"
      resetDescription="Replace current header settings with the default demo navigation."
    >
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
