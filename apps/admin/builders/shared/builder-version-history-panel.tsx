"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BuilderRevision } from "@/features/builders/lib/builder-revisions";
import { formatDate } from "@/utils/format";

interface BuilderVersionHistoryPanelProps<TSection> {
  open: boolean;
  revisions: BuilderRevision<TSection>[];
  onOpenChange: (open: boolean) => void;
  onRestore: (revisionId: string) => void | Promise<void>;
  /** When true, Restore asks for confirmation first */
  confirmRestore?: boolean;
}

/** Date AND time — five publishes in one day were five identical rows. */
function revisionStamp(savedAt: string): string {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return formatDate(savedAt);
  return `${formatDate(savedAt)} · ${date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function BuilderVersionHistoryPanel<TSection>({
  open,
  revisions,
  onOpenChange,
  onRestore,
  confirmRestore = true,
}: BuilderVersionHistoryPanelProps<TSection>) {
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  function handleOpenChange(next: boolean) {
    if (isRestoring) return;
    if (!next) setPendingRestoreId(null);
    onOpenChange(next);
  }

  function requestRestore(revisionId: string) {
    if (isRestoring) return;
    if (confirmRestore) {
      setPendingRestoreId(revisionId);
      return;
    }
    void runRestore(revisionId);
  }

  /**
   * Held open until the write lands.
   *
   * This used to fire `onRestore` un-awaited and clear `pendingRestoreId` on the
   * next line, so the full revision list snapped back with every Restore button
   * live while the first request was still going. An admin who read that as a
   * missed click and pressed Restore on a second revision sent two writes: the
   * server serialised them, the client applied them in response order, and the
   * editor could end up showing revision A while the stored draft held B.
   */
  async function runRestore(revisionId: string) {
    setIsRestoring(true);
    try {
      await onRestore(revisionId);
    } finally {
      setIsRestoring(false);
      setPendingRestoreId(null);
    }
  }

  function confirmPendingRestore() {
    if (!pendingRestoreId || isRestoring) return;
    void runRestore(pendingRestoreId);
  }

  const pendingLabel = revisions.find((item) => item.id === pendingRestoreId)?.label;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4" />
            {pendingRestoreId ? "Restore revision?" : "Version history"}
          </DialogTitle>
          <DialogDescription>
            {pendingRestoreId
              ? // Says what actually happens. A restore is a server write that
                // replaces the saved draft the moment it is confirmed — it is
                // not a local edit you can back out of afterwards.
                `“${pendingLabel ?? "This revision"}” replaces your saved draft on the server straight away. The draft you have now is not kept, and this cannot be undone.`
              : "Published snapshots saved on the server. Restore loads a revision into your draft."}
          </DialogDescription>
        </DialogHeader>

        {pendingRestoreId ? (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingRestoreId(null)}
              disabled={isRestoring}
            >
              Back
            </Button>
            <Button variant="destructive" onClick={confirmPendingRestore} disabled={isRestoring}>
              {isRestoring ? "Restoring…" : "Restore into draft"}
            </Button>
          </DialogFooter>
        ) : (
          <>
            <div className="panel-scroll max-h-80 space-y-2 overflow-y-auto">
              {revisions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  No published revisions yet. Publish to create the first snapshot.
                </p>
              ) : (
                revisions.map((revision) => (
                  <div
                    key={revision.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{revision.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {revisionStamp(revision.savedAt)} ·{" "}
                        {revision.sections.length}{" "}
                        {revision.sections.length === 1 ? "section" : "sections"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => requestRestore(revision.id)}
                      disabled={isRestoring}
                    >
                      Restore
                    </Button>
                  </div>
                ))
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
