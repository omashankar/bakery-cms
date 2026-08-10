"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { sortSections } from "@/features/cms-sections/lib/section-utils";
import {
  deriveHomepageMeta,
  fetchHomepageRevisions,
  fetchHomepageState,
  publishHomepage,
  resetHomepage,
  restoreHomepageRevision,
  saveHomepageDraft,
  BuilderRequestError,
  type HomepageRevision,
} from "@/features/cms-sections/data/homepage-sections-client";
import { BuilderVersionHistoryPanel } from "@/apps/admin/builders/shared/builder-version-history-panel";
import {
  fromScheduleInputValue,
  toScheduleInputValue,
} from "@/lib/datetime-local";
import { useUnsavedChangesGuard } from "@/apps/admin/builders/shared/use-unsaved-changes-guard";
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
import { adminShell } from "@/apps/admin/components/admin-shell";
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
  | { type: "discard" }
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
  const [revisions, setRevisions] = useState<HomepageRevision[]>([]);
  const [scheduledPublishAt, setScheduledPublishAt] = useState("");
  const [publishMeta, setPublishMeta] = useState(EMPTY_META);
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

  /**
   * What is on screen right now, readable after an await — see settleDirty.
   *
   * Written synchronously at every point that replaces the section list, not
   * from an effect. React flushes passive effects in a macrotask while a
   * resolved fetch continues in a microtask, so an effect-written ref can still
   * hold the pre-edit array when a save settles — and settleDirty would then
   * clear the unsaved flag over keystrokes that were never sent.
   */
  const latestSections = useRef<HomepageSectionInstance[]>([]);

  function applySections(next: HomepageSectionInstance[]) {
    latestSections.current = next;
    setSections(next);
  }

  /**
   * The store version this builder last saw.
   *
   * Sent with every write so the server can refuse one composed against a state
   * that has since moved on. Without it the builder is replace-all with nothing
   * to compare: a tab open since 09:00 and saved at 09:15 replaced everything
   * done in between, and Publish pushed that stale copy to the live storefront.
   */
  const versionRef = useRef<number | undefined>(undefined);

  /**
   * A refused write.
   *
   * A 409 means the stored layout moved on after this tab loaded it. The
   * admin's work stays on screen and stays flagged unsaved, and the version
   * ref is brought up to date so a SECOND, deliberate save can go through.
   * Without that the ref stayed pinned at the number the conflict rejected and
   * every later save in the tab conflicted too — the tab could never save
   * again, holding work that existed nowhere else.
   */
  function reportWriteFailure(error: unknown, fallback: string) {
    if (error instanceof BuilderRequestError && error.status === 409) {
      if (typeof error.currentVersion === "number") {
        versionRef.current = error.currentVersion;
      }
      toast.warning("This layout changed somewhere else", {
        description:
          "Your edits are still here and still unsaved. Reload to see the other version, or save again to replace it.",
        duration: 10000,
      });
      return;
    }
    toast.error(error instanceof Error ? error.message : fallback);
  }

  /**
   * Clear the unsaved flag only if what was just persisted is still what is on
   * screen.
   *
   * This ran unconditionally, so anything typed while a save was in flight — a
   * Mongo round trip, easily a second against a remote cluster — was declared
   * saved without ever having been in the request body. The badge cleared, the
   * Save button greyed out, and the unsaved-changes guard unregistered, so the
   * admin closed the tab and lost every character typed after the click.
   */
  function settleDirty(payload: HomepageSectionInstance[]) {
    if (latestSections.current === payload) setIsDirty(false);
  }

  const refreshRevisions = useCallback(async () => {
    try {
      setRevisions(await fetchHomepageRevisions());
    } catch {
      // Keep the last known history rather than blanking the panel.
    }
  }, []);

  const refreshMeta = useCallback(async () => {
    try {
      const state = await fetchHomepageState();
      versionRef.current = state.version ?? 0;
      const meta = deriveHomepageMeta(state);
      setPublishMeta(meta);
      setScheduledPublishAt(toScheduleInputValue(meta.scheduledPublishAt));
    } catch {
      // Leave the last known status on screen rather than blanking it.
    }
    await refreshRevisions();
  }, [refreshRevisions]);

  useEffect(() => {
    async function load() {
      try {
        const state = await fetchHomepageState();
        versionRef.current = state.version ?? 0;
        const draft = sortSections(state.draft.sections);
        applySections(draft);
        setSelectedId(draft[0]?.instanceId ?? null);
        setPublishMeta(deriveHomepageMeta(state));
        setScheduledPublishAt(toScheduleInputValue(state.draft.scheduledPublishAt));
      } catch {
        toast.error("Could not load the homepage builder");
      }
      await refreshRevisions();
      setMounted(true);
    }

    void load();
  }, [refreshRevisions]);

  // Covers a sidebar click as well as a reload — the previous beforeunload-only
  // guard never fired on an App Router transition.
  useUnsavedChangesGuard(isDirty);

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
    const sorted = sortSections(next);
    latestSections.current = sorted;
    setSections(sorted);
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
    const payload = sections;
    setIsSaving(true);
    try {
      const { version } = await saveHomepageDraft(
        payload,
        fromScheduleInputValue(scheduledPublishAt),
        versionRef.current
      );
      versionRef.current = version;
      settleDirty(payload);
      await refreshMeta();
      toast.success("Homepage draft saved");
    } catch (error) {
      // Keep isDirty set so the unsaved-changes guard still protects the work.
      reportWriteFailure(error, "Could not save the draft");
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmPublish() {
    const payload = sections;
    setIsSaving(true);
    try {
      const { version } = await publishHomepage(payload, versionRef.current);
      versionRef.current = version;
      setScheduledPublishAt("");
      settleDirty(payload);
      setConfirm(null);
      await refreshMeta();
      toast.success("Homepage published to storefront");
    } catch (error) {
      reportWriteFailure(error, "Could not publish");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleScheduleChange(value: string) {
    const payload = sections;
    setScheduledPublishAt(value);
    setIsDirty(true);
    // Gated like every other write. Preview and the schedule field were not,
    // so a second write could start while the first was in flight carrying the
    // same expectedVersion — and the builder conflicted with itself.
    setIsSaving(true);
    try {
      const { version } = await saveHomepageDraft(
        payload,
        fromScheduleInputValue(value),
        versionRef.current
      );
      versionRef.current = version;
      // The schedule write persists the whole draft, so nothing is unsaved after
      // it. Leaving the flag set left a standing "Unsaved" badge and armed the
      // leave-site prompt over a draft that was on the server — which trains an
      // admin to dismiss that prompt.
      settleDirty(payload);
      await refreshMeta();
      if (value) {
        toast.message("Publish scheduled", {
          description: new Date(value).toLocaleString(),
        });
      } else {
        toast.message("Schedule cleared");
      }
    } catch (error) {
      reportWriteFailure(error, "Could not update the schedule");
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePreview() {
    // Opened before the awaits: a browser only honours window.open while the
    // click's transient activation lasts, and two round trips can outlive it —
    // after which open() returns null silently, so Preview did nothing at all
    // and the catch never ran.
    // Opened WITHOUT "noopener": per the HTML spec the open steps return null
    // when noopener is set (and noreferrer implies it), so the handle was always
    // null — the tab was created, orphaned at about:blank on every click, and the
    // real navigation still fell through to a post-await window.open, which is
    // exactly the transient-activation problem this was meant to avoid. The
    // opener reference is severed by hand instead, which is the documented way
    // to keep the security property and the handle.
    const previewWindow = window.open("", "_blank");
    if (previewWindow) previewWindow.opener = null;
    const payload = sections;
    try {
      // Preview reads the draft from the server, so it has to be saved first.
      const { version } = await saveHomepageDraft(
        payload,
        fromScheduleInputValue(scheduledPublishAt),
        versionRef.current
      );
      versionRef.current = version;
      settleDirty(payload);
      await refreshMeta();
      const url = `${routes.store.home}?cmsPreview=1`;
      if (previewWindow && !previewWindow.closed) {
        previewWindow.location.replace(url);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      previewWindow?.close();
      reportWriteFailure(error, "Could not open preview");
    }
  }

  async function handleRestoreRevision(revisionId: string) {
    try {
      const snapshot = await restoreHomepageRevision(revisionId);
      applySections(sortSections(snapshot.sections));
      // A restore is a SERVER write, not a local edit. Flagging it unsaved put a
      // Discard button on screen that could not undo it — clicking it re-fetched
      // the very draft that had just been restored and reported "Discarded
      // unsaved changes", while the draft it was meant to bring back had been
      // overwritten the moment the restore was confirmed.
      setIsDirty(false);
      setHistoryOpen(false);
      await refreshMeta();
      toast.success("Revision restored into draft");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not restore the revision");
    }
  }

  async function confirmReset() {
    // The dialog button is `disabled={isSaving}`, which reset never set — so it
    // stayed live through its own request and a second click fired a second one.
    setIsSaving(true);
    try {
      const state = await resetHomepage();
      versionRef.current = state.version ?? versionRef.current;
      applySections(state.draft.sections);
      setSelectedId(state.draft.sections[0]?.instanceId ?? null);
      setIsDirty(false);
      setConfirm(null);
      await refreshMeta();
      toast.message("Homepage reset to defaults");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reset the homepage");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDiscard() {
    try {
      // Re-read the saved draft from the server and throw away local edits.
      const state = await fetchHomepageState();
      versionRef.current = state.version ?? 0;
      const draft = sortSections(state.draft.sections);
      applySections(draft);
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
      void confirmReset();
      return;
    }
    if (confirm.type === "discard") {
      setConfirm(null);
      void handleDiscard();
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
          // Discard destroys more than any other button here — the whole unsaved
          // session, with no undo — and it sat one place along from Preview,
          // wired straight to onClick while removing a single section asked
          // first. It asks now.
          onDiscard={() => setConfirm({ type: "discard" })}
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
            mobilePanel === "editor" ? "flex flex-col" : "hidden xl:flex xl:flex-col"
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
                  : confirm?.type === "discard"
                    ? "Discard unsaved changes?"
                    : "Remove section?"}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {confirm?.type === "publish"
                ? "This updates the live /store homepage for everyone."
                : confirm?.type === "reset"
                  ? // The dialog used to promise strictly less than Reset does:
                    // it wiped the whole revision log too, so the History panel
                    // an admin was counting on to undo it came back empty.
                    "Draft and published homepage will be replaced with defaults. The layout that is live now is saved to Version History first, so you can restore it."
                  : confirm?.type === "discard"
                    ? "Every change you have made since the last save will be thrown away. This cannot be undone."
                    : "Removed from the current draft. Save or publish to keep the change."}
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant={confirm?.type === "publish" ? "bakery" : "destructive"}
              onClick={runConfirm}
              disabled={isSaving}
            >
              {confirm?.type === "publish"
                ? "Publish"
                : confirm?.type === "reset"
                  ? "Reset"
                  : confirm?.type === "discard"
                    ? "Discard"
                    : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
