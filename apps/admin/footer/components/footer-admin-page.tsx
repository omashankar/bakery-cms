"use client";

import { useMemo, useState } from "react";
import { Columns3, Plus, Trash2 } from "lucide-react";
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
import type { FooterColumnConfig, FooterLinkItem, FooterSettings } from "@/types/site-layout";
import { SettingsSectionShell } from "@/apps/admin/settings/components/settings-section-shell";
import { useHydratedForm } from "@/features/settings/lib/use-hydrated-form";
import { siteLayoutHydration } from "@/features/site-layout/lib/site-layout-api";
import { ensureSiteLayoutHydrated } from "@/components/shared/site-layout-server-sync";
import { SettingsHydrationNotice } from "@/apps/admin/settings/components/settings-field-error";
import {
  loadFooterSettings,
  resetFooterSettings,
  saveFooterSettings,
} from "@/features/site-layout/lib/footer-repository";
import {
  createFooterColumn,
  defaultFooterSettings,
  getFooterOverview,
  type FooterOverview,
} from "@/features/site-layout/lib/footer-utils";

const EMPTY_OVERVIEW: FooterOverview = {
  columns: 0,
  links: 0,
  sectionsEnabled: 0,
  sectionsTotal: 4,
};

const SECTION_TOGGLES = [
  ["showContact", "Contact block", "Address and phone in the footer"],
  ["showHours", "Opening hours", "Store hours block"],
  ["showSocial", "Social links", "Social icons row"],
  ["showMap", "Map embed", "Location map section"],
] as const;

export function FooterAdminPage() {
  // The shared hydrated form. This page hand-rolled it: a one-shot `[]`-dep
  // effect read localStorage on mount and declared the form ready in the same
  // tick. `SiteLayoutServerSync` reads the server's copy from a root-layout
  // effect, so on a hard load that read is still in flight and
  // `loadFooterSettings()` answers with the DEMO FOOTER — and saving is a
  // replace-all, so a single edit replaced every footer column and every link
  // in them with the demo set.
  const {
    value: settings,
    isDirty,
    hydration,
    isWriting,
    canSave,
    edit: setSettings,
    discard,
    runWrite,
  } = useHydratedForm<FooterSettings>({
    read: loadFooterSettings,
    fallback: defaultFooterSettings,
    gate: siteLayoutHydration,
    ensureHydrated: ensureSiteLayoutHydrated,
  });
  const [removeColumn, setRemoveColumn] = useState<FooterColumnConfig | null>(null);
  const [removeLink, setRemoveLink] = useState<{
    columnId: string;
    link: FooterLinkItem;
  } | null>(null);

  const overview = useMemo(
    () => (hydration === "pending" ? EMPTY_OVERVIEW : getFooterOverview(settings)),
    [hydration, settings]
  );

  function updateColumn(columnId: string, title: string) {
    setSettings((prev) => ({
      ...prev,
      columns: prev.columns.map((col) => (col.id === columnId ? { ...col, title } : col)),
    }));
  }

  function updateLink(columnId: string, linkId: string, patch: Partial<FooterLinkItem>) {
    setSettings((prev) => ({
      ...prev,
      columns: prev.columns.map((col) =>
        col.id === columnId
          ? {
              ...col,
              links: col.links.map((link) =>
                link.id === linkId ? { ...link, ...patch } : link
              ),
            }
          : col
      ),
    }));
  }

  function addLink(columnId: string) {
    setSettings((prev) => ({
      ...prev,
      columns: prev.columns.map((col) =>
        col.id === columnId
          ? {
              ...col,
              links: [
                ...col.links,
                { id: `link-${Date.now()}`, label: "New link", href: "/store" },
              ],
            }
          : col
      ),
    }));
  }

  function addColumn() {
    setSettings((prev) => ({
      ...prev,
      columns: [...prev.columns, createFooterColumn("New Column")],
    }));
  }

  function confirmRemoveColumn() {
    if (!removeColumn) return;
    setSettings((prev) => ({
      ...prev,
      columns: prev.columns.filter((col) => col.id !== removeColumn.id),
    }));
    setRemoveColumn(null);
    toast.message("Column removed");
  }

  function confirmRemoveLink() {
    if (!removeLink) return;
    setSettings((prev) => ({
      ...prev,
      columns: prev.columns.map((col) =>
        col.id === removeLink.columnId
          ? { ...col, links: col.links.filter((link) => link.id !== removeLink.link.id) }
          : col
      ),
    }));
    setRemoveLink(null);
    toast.message("Link removed");
  }

  async function handleSave() {
    if (settings.columns.some((col) => !col.title.trim())) {
      toast.error("Every column needs a title");
      return;
    }
    if (
      settings.columns.some((col) =>
        col.links.some((link) => !link.label.trim() || !link.href.trim())
      )
    ) {
      toast.error("Every footer link needs a label and URL");
      return;
    }
    if (!canSave) return;
    await runWrite(async () => {
      const { value: next, persisted } = await saveFooterSettings(settings);
      // Only mark clean when the SERVER has it — the dirty flag is what keeps
      // the Save button enabled, so adopting a rejected value removes the retry.
      return { value: next, accepted: reportWrite(persisted, "Footer settings saved") };
    });
  }

  function handleDiscard() {
    discard();
    toast.message("Discarded unsaved changes");
  }

  async function handleReset() {
    if (!canSave) return;
    await runWrite(async () => {
      const { value: next, persisted } = await resetFooterSettings();
      return { value: next, accepted: reportWrite(persisted, "Footer reset to defaults") };
    });
  }

  return (
    <SettingsSectionShell
      title="Footer"
      description={
        hydration === "ready"
          ? `${overview.columns} columns · ${overview.links} links · ${overview.sectionsEnabled}/${overview.sectionsTotal} sections on`
          : "Manage footer columns and section visibility"
      }
      isDirty={isDirty}
      // Behind the skeleton until the SERVER's copy has landed. Gating only
      // the Save button leaves the gap open: the admin edits the seed, the
      // arriving values are skipped because the form is dirty, and Save then
      // unlocks over it.
      mounted={hydration !== "pending"}
      isSaving={isWriting}
      saveDisabled={!canSave}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onReset={handleReset}
      resetTitle="Reset footer?"
      resetDescription="Replace current footer settings with the default demo columns and sections."
    >
      <SettingsHydrationNotice hydration={hydration} />
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Footer sections</CardTitle>
          <CardDescription>Toggle which blocks appear in the site footer.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {SECTION_TOGGLES.map(([key, label, hint]) => (
            <div
              key={key}
              className="flex items-center justify-between gap-4 rounded-xl border border-border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
              <Switch
                checked={settings[key]}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, [key]: checked }))
                }
                aria-label={label}
              />
            </div>
          ))}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="copyright">Copyright suffix</Label>
            <Input
              id="copyright"
              value={settings.copyrightSuffix}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  copyrightSuffix: e.target.value,
                }))
              }
              placeholder="All rights reserved."
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-heading text-lg font-semibold">Link columns</h2>
            <p className="text-sm text-muted-foreground">
              Group footer links into titled columns.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={addColumn}>
            <Plus className="size-4" />
            Add column
          </Button>
        </div>

        {settings.columns.length === 0 ? (
          <EmptyState
            icon={Columns3}
            title="No footer columns"
            description="Add a column to organize storefront footer links."
            action={
              <Button variant="bakery" onClick={addColumn}>
                <Plus className="size-4" />
                Add column
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {settings.columns.map((column) => (
              <Card key={column.id} className="shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label htmlFor={`col-title-${column.id}`} className="sr-only">
                      Column title
                    </Label>
                    <Input
                      id={`col-title-${column.id}`}
                      value={column.title}
                      onChange={(e) => updateColumn(column.id, e.target.value)}
                      className="font-semibold"
                      placeholder="Column title"
                    />
                    <p className="text-xs text-muted-foreground">
                      {column.links.length} link{column.links.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setRemoveColumn(column)}
                    disabled={settings.columns.length <= 1}
                    aria-label={`Remove ${column.title || "column"}`}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {column.links.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                      No links in this column yet.
                    </p>
                  ) : (
                    column.links.map((link, index) => (
                      <div
                        key={link.id}
                        className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1fr_1fr_auto]"
                      >
                        <Input
                          value={link.label}
                          onChange={(e) =>
                            updateLink(column.id, link.id, { label: e.target.value })
                          }
                          placeholder="Label"
                          aria-label={`Link ${index + 1} label in ${column.title || "column"}`}
                        />
                        <Input
                          value={link.href}
                          onChange={(e) =>
                            updateLink(column.id, link.id, { href: e.target.value })
                          }
                          placeholder="/store/..."
                          aria-label={`Link ${index + 1} URL in ${column.title || "column"}`}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="justify-self-end sm:justify-self-auto"
                          onClick={() => setRemoveLink({ columnId: column.id, link })}
                          aria-label={`Remove ${link.label || "link"}`}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    ))
                  )}
                  <Button size="sm" variant="outline" onClick={() => addLink(column.id)}>
                    <Plus className="size-4" />
                    Add link
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(removeColumn)}
        onOpenChange={(open) => !open && setRemoveColumn(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove column?</DialogTitle>
            <DialogDescription>
              Remove &ldquo;{removeColumn?.title ?? "this column"}&rdquo; and its links? Save
              to apply permanently.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setRemoveColumn(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmRemoveColumn}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(removeLink)} onOpenChange={(open) => !open && setRemoveLink(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove link?</DialogTitle>
            <DialogDescription>
              Remove &ldquo;{removeLink?.link.label ?? "this link"}&rdquo; from the footer?
              Save to apply permanently.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setRemoveLink(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmRemoveLink}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsSectionShell>
  );
}
