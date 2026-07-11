"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getDraftHomepageSections,
  getHomepagePublishMeta,
  HOMEPAGE_REVISIONS_KEY,
  processScheduledHomepagePublish,
  publishHomepageSections,
  resetHomepageToDefaults,
  saveDraftHomepageSections,
  scheduleHomepagePublish,
  sortSections,
} from "@/features/cms-sections/lib/homepage-store";
import {
  listBuilderRevisions,
  restoreBuilderRevision,
} from "@/features/admin/builders/shared/builder-revisions";
import { BuilderVersionHistoryPanel } from "@/features/admin/builders/shared/builder-version-history-panel";
import { HomepageSectionRenderer } from "@/features/cms-sections/homepage-section-renderer";
import {
  createSectionInstance,
  getRegistryEntry,
  HOMEPAGE_SECTION_REGISTRY,
} from "@/constants/section-registry";
import { routes } from "@/constants/routes";
import type {
  HomepageSectionInstance,
  HomepageSectionType,
} from "@/types/homepage-builder";
import { AddSectionDialog } from "../shared/add-section-dialog";
import { BuilderPreviewPanel } from "../shared/builder-preview-panel";
import { BuilderToolbar } from "../shared/builder-toolbar";
import { adminShell } from "@/features/admin/components/admin-shell";
import { SectionEditorPanel } from "../shared/section-editor-panel";
import { SectionListPanel } from "../shared/section-list-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ConfirmAction =
  | { type: "publish" }
  | { type: "reset" }
  | { type: "remove"; id: string };

type ListFilter = "all" | "visible" | "hidden";

const EMPTY_META = {
  draftUpdatedAt: null as string | null,
  publishedUpdatedAt: null as string | null,
  scheduledPublishAt: null as string | null,
  hasUnpublishedChanges: false,
  sectionCount: 0,
  visibleCount: 0,
};

export function HomepageBuilderPage() {
  const [mounted, setMounted] = useState(false);
  const [sections, setSections] = useState<HomepageSectionInstance[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"sections" | "preview" | "editor">(
    "preview"
  );
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisions, setRevisions] = useState<
    ReturnType<typeof listBuilderRevisions>
  >([]);
  const [scheduledPublishAt, setScheduledPublishAt] = useState("");
  const [publishMeta, setPublishMeta] = useState(EMPTY_META);
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

  const refreshMeta = useCallback(() => {
    processScheduledHomepagePublish();
    const meta = getHomepagePublishMeta();
    setPublishMeta(meta);
    setScheduledPublishAt(
      meta.scheduledPublishAt
        ? new Date(meta.scheduledPublishAt).toISOString().slice(0, 16)
        : ""
    );
    setRevisions(listBuilderRevisions(HOMEPAGE_REVISIONS_KEY));
  }, []);

  useEffect(() => {
    const draft = getDraftHomepageSections();
    setSections(draft);
    setSelectedId(draft[0]?.instanceId ?? null);
    refreshMeta();
    setMounted(true);
  }, [refreshMeta]);

  useEffect(() => {
    if (!isDirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const selectedSection = useMemo(
    () => sections.find((section) => section.instanceId === selectedId) ?? null,
    [sections, selectedId]
  );

  const visibleCount = useMemo(
    () => sections.filter((section) => section.isVisible).length,
    [sections]
  );

  const listSections = useMemo(() => {
    if (listFilter === "visible") return sections.filter((section) => section.isVisible);
    if (listFilter === "hidden") return sections.filter((section) => !section.isVisible);
    return sections;
  }, [sections, listFilter]);

  const updateSections = useCallback((next: HomepageSectionInstance[]) => {
    setSections(sortSections(next));
    setIsDirty(true);
  }, []);

  function handleToggleVisible(id: string, visible: boolean) {
    updateSections(
      sections.map((section) =>
        section.instanceId === id ? { ...section, isVisible: visible } : section
      )
    );
  }

  function handleReorder(orderedIds: string[]) {
    if (listFilter !== "all") {
      toast.message("Show all sections to reorder");
      return;
    }

    const current = [...sections]
      .sort((a, b) => a.order - b.order)
      .map((section) => section.instanceId);
    if (
      current.length === orderedIds.length &&
      current.every((id, index) => id === orderedIds[index])
    ) {
      return;
    }

    const byId = new Map(sections.map((section) => [section.instanceId, section]));
    const next = orderedIds
      .map((id, index) => {
        const section = byId.get(id);
        return section ? { ...section, order: index } : null;
      })
      .filter((section): section is HomepageSectionInstance => section !== null);

    if (next.length !== sections.length) return;
    updateSections(next);
  }

  function handleSectionChange(section: HomepageSectionInstance) {
    updateSections(
      sections.map((item) => (item.instanceId === section.instanceId ? section : item))
    );
  }

  function handleAddSection(type: HomepageSectionType) {
    const instance = createSectionInstance(type, sections.length);
    updateSections([...sections, instance]);
    setSelectedId(instance.instanceId);
    setListFilter("all");
    setMobilePanel("editor");
    toast.success(`${getRegistryEntry(type)?.label ?? "Section"} added`);
  }

  function handleDuplicateSection(id: string) {
    const source = sections.find((section) => section.instanceId === id);
    if (!source) return;

    const duplicate: HomepageSectionInstance = {
      ...source,
      instanceId: `${source.type}-${Date.now()}`,
      order: sections.length,
      content: { ...source.content },
    };

    updateSections([...sections, duplicate]);
    setSelectedId(duplicate.instanceId);
    setListFilter("all");
    toast.success("Section duplicated");
  }

  function removeSection(id: string) {
    if (sections.length <= 1) {
      toast.error("At least one section is required");
      return;
    }

    const next = sections
      .filter((section) => section.instanceId !== id)
      .sort((a, b) => a.order - b.order)
      .map((section, index) => ({ ...section, order: index }));
    updateSections(next);
    if (selectedId === id) {
      setSelectedId(next[0]?.instanceId ?? null);
    }
    toast.message("Section removed");
  }

  async function handleSaveDraft() {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    saveDraftHomepageSections(
      sections,
      scheduledPublishAt ? new Date(scheduledPublishAt).toISOString() : null
    );
    setIsDirty(false);
    setIsSaving(false);
    refreshMeta();
    toast.success("Homepage draft saved");
  }

  async function confirmPublish() {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 350));
    publishHomepageSections(sections);
    setScheduledPublishAt("");
    setIsDirty(false);
    setIsSaving(false);
    setConfirm(null);
    refreshMeta();
    toast.success("Homepage published to storefront");
  }

  function handleScheduleChange(value: string) {
    setScheduledPublishAt(value);
    setIsDirty(true);
    if (value) {
      scheduleHomepagePublish(sections, new Date(value).toISOString());
      toast.message("Publish scheduled", {
        description: new Date(value).toLocaleString(),
      });
      refreshMeta();
      return;
    }
    saveDraftHomepageSections(sections, null);
    refreshMeta();
    toast.message("Schedule cleared");
  }

  function handlePreview() {
    saveDraftHomepageSections(
      sections,
      scheduledPublishAt ? new Date(scheduledPublishAt).toISOString() : null
    );
    setIsDirty(false);
    refreshMeta();
    window.open(`${routes.store.home}?cmsPreview=1`, "_blank", "noopener,noreferrer");
  }

  function handleRestoreRevision(revisionId: string) {
    const restored = restoreBuilderRevision(HOMEPAGE_REVISIONS_KEY, revisionId);
    if (!restored) return;
    setSections(sortSections(restored as HomepageSectionInstance[]));
    setIsDirty(true);
    setHistoryOpen(false);
    toast.success("Revision restored into draft");
  }

  function confirmReset() {
    const state = resetHomepageToDefaults();
    setSections(state.draft.sections);
    setSelectedId(state.draft.sections[0]?.instanceId ?? null);
    setIsDirty(false);
    setConfirm(null);
    refreshMeta();
    toast.message("Homepage reset to defaults");
  }

  function handleDiscard() {
    const draft = getDraftHomepageSections();
    setSections(draft);
    setSelectedId((current) =>
      current && draft.some((section) => section.instanceId === current)
        ? current
        : draft[0]?.instanceId ?? null
    );
    setIsDirty(false);
    refreshMeta();
    toast.message("Discarded unsaved changes");
  }

  function runConfirm() {
    if (!confirm) return;
    if (confirm.type === "publish") {
      void confirmPublish();
      return;
    }
    if (confirm.type === "reset") {
      confirmReset();
      return;
    }
    removeSection(confirm.id);
    setConfirm(null);
  }

  const metaForToolbar = mounted
    ? {
        sectionCount: sections.length,
        visibleCount,
        publishedAt: publishMeta.publishedUpdatedAt,
        hasUnpublishedChanges: publishMeta.hasUnpublishedChanges || isDirty,
        scheduledPublishAt: publishMeta.scheduledPublishAt,
      }
    : {
        sectionCount: 0,
        visibleCount: 0,
        publishedAt: null,
        hasUnpublishedChanges: false,
        scheduledPublishAt: null,
      };

  return (
    <div className="-mx-4 -my-4 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden sm:-mx-5 sm:-my-5 lg:-mx-6 lg:-my-6">
      <div className="shrink-0">
        <BuilderToolbar
          title="Homepage Builder"
          description={
            mounted
              ? `${visibleCount} of ${sections.length} sections visible on /store`
              : "Loading layout…"
          }
          isDirty={isDirty}
          isSaving={isSaving}
          onSaveDraft={handleSaveDraft}
          onPublish={() => setConfirm({ type: "publish" })}
          onReset={() => setConfirm({ type: "reset" })}
          onDiscard={handleDiscard}
          onPreview={handlePreview}
          onOpenHistory={() => setHistoryOpen(true)}
          scheduledPublishAt={scheduledPublishAt}
          onScheduleChange={handleScheduleChange}
          meta={metaForToolbar}
        />
      </div>

      <BuilderVersionHistoryPanel
        open={historyOpen}
        revisions={revisions}
        onOpenChange={setHistoryOpen}
        onRestore={handleRestoreRevision}
      />

      <div
        className={cn(
          "shrink-0 border-b border-border bg-card py-2 lg:hidden",
          adminShell.contentWrap
        )}
      >
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {(["sections", "preview", "editor"] as const).map((panel) => (
            <button
              key={panel}
              type="button"
              onClick={() => setMobilePanel(panel)}
              className={cn(
                "rounded-md px-2 py-1.5 text-xs font-medium capitalize",
                mobilePanel === panel ? "bg-card shadow-sm" : "text-muted-foreground"
              )}
            >
              {panel}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[220px_minmax(0,1fr)_260px] xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside
          className={cn(
            "min-h-0 overflow-hidden border-r border-border bg-card",
            mobilePanel === "sections" ? "flex flex-col" : "hidden lg:flex lg:flex-col"
          )}
        >
          <SectionListPanel
            sections={listSections}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setMobilePanel("editor");
            }}
            onToggleVisible={handleToggleVisible}
            onReorder={handleReorder}
            onAdd={() => setAddDialogOpen(true)}
            onDuplicate={handleDuplicateSection}
            onRemove={(id) => setConfirm({ type: "remove", id })}
            resolveEntry={(type) => getRegistryEntry(type)}
            reorderEnabled={listFilter === "all"}
            totalCount={sections.length}
            emptyMessage={
              listFilter === "hidden"
                ? "No hidden sections."
                : listFilter === "visible"
                  ? "No visible sections."
                  : "No sections yet."
            }
            headerExtra={
              <div className="grid grid-cols-3 gap-0.5 rounded-md bg-muted p-0.5">
                {(
                  [
                    { id: "all" as const, label: "All" },
                    { id: "visible" as const, label: "On" },
                    { id: "hidden" as const, label: "Off" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setListFilter(item.id)}
                    className={cn(
                      "rounded px-1.5 py-1 text-[11px] font-medium",
                      listFilter === item.id
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            }
          />
        </aside>

        <main
          className={cn(
            "min-h-0 overflow-hidden bg-muted",
            mobilePanel === "preview" ? "flex flex-col" : "hidden lg:flex lg:flex-col"
          )}
        >
          <BuilderPreviewPanel
            sections={sections}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setMobilePanel("editor");
            }}
            renderSection={(section, ctx) => (
              <HomepageSectionRenderer
                key={section.instanceId}
                section={section}
                selected={ctx.selected}
                interactive
                onSelect={ctx.onSelect}
              />
            )}
          />
        </main>

        <aside
          className={cn(
            "min-h-0 overflow-hidden border-l border-border bg-card",
            mobilePanel === "editor" ? "flex flex-col" : "hidden lg:flex lg:flex-col"
          )}
        >
          <SectionEditorPanel
            section={selectedSection}
            onChange={handleSectionChange}
            resolveEntry={(type) => getRegistryEntry(type)}
            settingsNote="Cake grids use the catalog. Promo banners come from Banner Manager. Site footer is managed under Footer."
          />
        </aside>
      </div>

      <AddSectionDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddSection}
        registry={HOMEPAGE_SECTION_REGISTRY}
        title="Add homepage section"
        description="Choose a section type to add to the layout."
      />

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirm?.type === "publish"
                ? "Publish homepage?"
                : confirm?.type === "reset"
                  ? "Reset homepage?"
                  : "Remove section?"}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {confirm?.type === "publish"
                ? "This updates the live /store homepage for everyone."
                : confirm?.type === "reset"
                  ? "Draft and published homepage will be replaced with defaults."
                  : "Removed from the current draft. Save or publish to keep the change."}
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant={
                confirm?.type === "reset" || confirm?.type === "remove"
                  ? "destructive"
                  : "bakery"
              }
              onClick={runConfirm}
              disabled={isSaving}
            >
              {confirm?.type === "publish"
                ? "Publish"
                : confirm?.type === "reset"
                  ? "Reset"
                  : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
