"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createWeddingSectionInstance,
  getWeddingRegistryEntry,
  WEDDING_SECTION_REGISTRY,
} from "@/constants/wedding-section-registry";
import { WeddingSectionRenderer } from "@/features/cms-sections/wedding-section-renderer";
import {
  sortSections,
  WEDDING_REVISIONS_KEY,
} from "@/features/cms-sections/lib/wedding-store";
import {
  deriveWeddingMeta,
  fetchWeddingState,
  publishWedding,
  resetWedding,
  saveWeddingDraftRequest,
} from "@/features/cms-sections/data/wedding-sections-client";
import {
  listBuilderRevisions,
  restoreBuilderRevision,
} from "@/features/builders/lib/builder-revisions";
import { BuilderVersionHistoryPanel } from "@/features/admin/builders/shared/builder-version-history-panel";
import { routes } from "@/constants/routes";
import type { WeddingSectionInstance, WeddingSectionType } from "@/types/wedding-builder";
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

export function WeddingBuilderPage() {
  const [mounted, setMounted] = useState(false);
  const [sections, setSections] = useState<WeddingSectionInstance[]>([]);
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

  const refreshMeta = useCallback(async () => {
    try {
      const meta = deriveWeddingMeta(await fetchWeddingState());
      setPublishMeta(meta);
      setScheduledPublishAt(
        meta.scheduledPublishAt
          ? new Date(meta.scheduledPublishAt).toISOString().slice(0, 16)
          : ""
      );
    } catch {
      // Leave the last known status on screen rather than blanking it.
    }
    setRevisions(listBuilderRevisions(WEDDING_REVISIONS_KEY));
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const state = await fetchWeddingState();
        const draft = sortSections(state.draft.sections);
        setSections(draft);
        setSelectedId(draft[0]?.instanceId ?? null);
        setPublishMeta(deriveWeddingMeta(state));
        setScheduledPublishAt(
          state.draft.scheduledPublishAt
            ? new Date(state.draft.scheduledPublishAt).toISOString().slice(0, 16)
            : ""
        );
      } catch {
        toast.error("Could not load the wedding builder");
      }
      setRevisions(listBuilderRevisions(WEDDING_REVISIONS_KEY));
      setMounted(true);
    }

    void load();
  }, []);

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

  const updateSections = useCallback((next: WeddingSectionInstance[]) => {
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
      .filter((section): section is WeddingSectionInstance => section !== null);

    if (next.length !== sections.length) return;
    updateSections(next);
  }

  function handleSectionChange(section: WeddingSectionInstance) {
    updateSections(
      sections.map((item) => (item.instanceId === section.instanceId ? section : item))
    );
  }

  function handleAddSection(type: WeddingSectionType) {
    const instance = createWeddingSectionInstance(type, sections.length);
    updateSections([...sections, instance]);
    setSelectedId(instance.instanceId);
    setListFilter("all");
    setMobilePanel("editor");
    toast.success(`${getWeddingRegistryEntry(type)?.label ?? "Section"} added`);
  }

  function handleDuplicateSection(id: string) {
    const source = sections.find((section) => section.instanceId === id);
    if (!source) return;

    const duplicate: WeddingSectionInstance = {
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
    try {
      await saveWeddingDraftRequest(
        sections,
        scheduledPublishAt ? new Date(scheduledPublishAt).toISOString() : null
      );
      setIsDirty(false);
      await refreshMeta();
      toast.success("Wedding page draft saved");
    } catch (error) {
      // Keep isDirty set so the unsaved-changes guard still protects the work.
      toast.error(error instanceof Error ? error.message : "Could not save the draft");
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmPublish() {
    setIsSaving(true);
    try {
      await publishWedding(sections);
      setScheduledPublishAt("");
      setIsDirty(false);
      setConfirm(null);
      await refreshMeta();
      toast.success("Wedding page published to storefront");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleScheduleChange(value: string) {
    setScheduledPublishAt(value);
    setIsDirty(true);
    try {
      await saveWeddingDraftRequest(sections, value ? new Date(value).toISOString() : null);
      await refreshMeta();
      if (value) {
        toast.message("Publish scheduled", {
          description: new Date(value).toLocaleString(),
        });
      } else {
        toast.message("Schedule cleared");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the schedule");
    }
  }

  async function handlePreview() {
    // Preview reads the draft from the server, so it has to be saved first.
    try {
      await saveWeddingDraftRequest(
        sections,
        scheduledPublishAt ? new Date(scheduledPublishAt).toISOString() : null
      );
      setIsDirty(false);
      await refreshMeta();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open preview");
      return;
    }
    window.open(
      `${routes.store.weddingCakes}?cmsPreview=wedding`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function handleRestoreRevision(revisionId: string) {
    const restored = restoreBuilderRevision(WEDDING_REVISIONS_KEY, revisionId);
    if (!restored) return;
    setSections(sortSections(restored as WeddingSectionInstance[]));
    setIsDirty(true);
    setHistoryOpen(false);
    toast.success("Revision restored into draft");
  }

  async function confirmReset() {
    try {
      const state = await resetWedding();
      setSections(state.draft.sections);
      setSelectedId(state.draft.sections[0]?.instanceId ?? null);
      setIsDirty(false);
      setConfirm(null);
      await refreshMeta();
      toast.message("Wedding page reset to defaults");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reset the wedding page");
    }
  }

  async function handleDiscard() {
    try {
      // Re-read the saved draft from the server and throw away local edits.
      const state = await fetchWeddingState();
      const draft = sortSections(state.draft.sections);
      setSections(draft);
      setSelectedId((current) =>
        current && draft.some((section) => section.instanceId === current)
          ? current
          : draft[0]?.instanceId ?? null
      );
      setIsDirty(false);
      await refreshMeta();
      toast.message("Discarded unsaved changes");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not discard changes");
    }
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
          title="Wedding Builder"
          description={
            mounted
              ? `${visibleCount} of ${sections.length} sections visible on /store/wedding-cakes`
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
          "shrink-0 border-b border-border bg-card py-2 xl:hidden",
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

      <div className="grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside
          className={cn(
            "min-h-0 overflow-hidden border-r border-border bg-card",
            mobilePanel === "sections" ? "flex flex-col" : "hidden xl:flex xl:flex-col"
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
            resolveEntry={(type) => getWeddingRegistryEntry(type)}
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
            mobilePanel === "preview" ? "flex flex-col" : "hidden xl:flex xl:flex-col"
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
              <WeddingSectionRenderer
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
            mobilePanel === "editor" ? "flex flex-col" : "hidden xl:flex xl:flex-col"
          )}
        >
          <SectionEditorPanel
            section={selectedSection}
            onChange={handleSectionChange}
            resolveEntry={(type) => getWeddingRegistryEntry(type)}
            settingsNote="Collections and offers pull from published cakes and active wedding coupons. Testimonials and FAQ use published admin content."
          />
        </aside>
      </div>

      <AddSectionDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddSection}
        registry={WEDDING_SECTION_REGISTRY}
        title="Add wedding section"
        description="Choose a section type to add to the wedding page layout."
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
                ? "Publish wedding page?"
                : confirm?.type === "reset"
                  ? "Reset wedding page?"
                  : "Remove section?"}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {confirm?.type === "publish"
                ? "This updates the live /store/wedding-cakes page for everyone."
                : confirm?.type === "reset"
                  ? "Draft and published wedding page will be replaced with defaults."
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
