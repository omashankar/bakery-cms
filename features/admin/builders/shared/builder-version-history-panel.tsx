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
import type { BuilderRevision } from "./builder-revisions";
import { formatDate } from "@/utils/format";

interface BuilderVersionHistoryPanelProps<TSection> {
  open: boolean;
  revisions: BuilderRevision<TSection>[];
  onOpenChange: (open: boolean) => void;
  onRestore: (revisionId: string) => void;
  /** When true, Restore asks for confirmation first */
  confirmRestore?: boolean;
}

export function BuilderVersionHistoryPanel<TSection>({
  open,
  revisions,
  onOpenChange,
  onRestore,
  confirmRestore = true,
}: BuilderVersionHistoryPanelProps<TSection>) {
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) setPendingRestoreId(null);
    onOpenChange(next);
  }

  function requestRestore(revisionId: string) {
    if (confirmRestore) {
      setPendingRestoreId(revisionId);
      return;
    }
    onRestore(revisionId);
  }

  function confirmPendingRestore() {
    if (!pendingRestoreId) return;
    onRestore(pendingRestoreId);
    setPendingRestoreId(null);
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
              ? `“${pendingLabel ?? "This revision"}” will replace your current draft. Unsaved edits will be lost.`
              : "Published snapshots saved in this browser. Restore loads a revision into your draft."}
          </DialogDescription>
        </DialogHeader>

        {pendingRestoreId ? (
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRestoreId(null)}>
              Back
            </Button>
            <Button variant="bakery" onClick={confirmPendingRestore}>
              Restore into draft
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
                        {formatDate(revision.savedAt)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => requestRestore(revision.id)}
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
