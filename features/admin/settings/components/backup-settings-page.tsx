"use client";

import { Download, History, RotateCcw, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { AdminPage, AdminPageHeader } from "@/features/admin/components";
import { formatRelativeTime } from "@/utils/format";
import type { BackupSnapshot } from "@/types/backup";
import { knownStorageKeys } from "../lib/settings-utils";
import { importLocalStorageBackup } from "../lib/settings-repository";
import {
  BACKUP_UPDATED_EVENT,
  deleteBackupSnapshot,
  exportAndArchiveBackup,
  formatBackupSize,
  loadBackupHistory,
  restoreBackupSnapshot,
} from "../lib/backup-repository";

export function BackupSettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [history, setHistory] = useState<BackupSnapshot[]>([]);
  const [backupLabel, setBackupLabel] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<BackupSnapshot | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BackupSnapshot | null>(null);

  function refresh() {
    setHistory(loadBackupHistory());
  }

  useEffect(() => {
    refresh();
    setMounted(true);
    function handleUpdate() {
      refresh();
    }
    window.addEventListener(BACKUP_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(BACKUP_UPDATED_EVENT, handleUpdate);
  }, []);

  function handleExport() {
    const snapshot = exportAndArchiveBackup(
      backupLabel.trim() || `Manual backup ${new Date().toLocaleString()}`
    );
    const blob = new Blob([JSON.stringify(snapshot.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bakery-cms-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setBackupLabel("");
    refresh();
    toast.success(`Exported and archived ${snapshot.keyCount} data keys`);
  }

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Record<string, string | null>;
        const count = importLocalStorageBackup(parsed);
        exportAndArchiveBackup(`Before import — ${new Date().toLocaleString()}`);
        refresh();
        toast.success(`Restored ${count} data keys — reload pages to see changes`);
      } catch {
        toast.error("Invalid backup file");
      }
    };
    reader.readAsText(file);
  }

  function confirmRestore() {
    if (!restoreTarget) return;
    const count = restoreBackupSnapshot(restoreTarget.id);
    refresh();
    toast.success(`Restored ${count} keys from backup history`);
    setRestoreTarget(null);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteBackupSnapshot(deleteTarget.id);
    refresh();
    toast.success("Backup snapshot removed");
    setDeleteTarget(null);
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Backup & Restore"
        description="Export all CMS data, restore from file, and keep a local backup history."
      />

      {!mounted ? (
        <div className="min-h-64 animate-pulse rounded-xl border border-border bg-muted" />
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Export backup</CardTitle>
                <CardDescription>
                  Downloads a JSON file and saves a snapshot to backup history.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="backup-label">Snapshot label (optional)</Label>
                  <Input
                    id="backup-label"
                    value={backupLabel}
                    onChange={(e) => setBackupLabel(e.target.value)}
                    placeholder="e.g. Before catalog update"
                  />
                </div>
                <Button variant="bakery" onClick={handleExport}>
                  <Download className="size-4" />
                  Download &amp; archive
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Import backup</CardTitle>
                <CardDescription>
                  Upload a JSON backup file. A safety snapshot is created before import.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportFile(file);
                    e.target.value = "";
                  }}
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="size-4" />
                  Upload backup file
                </Button>
              </CardContent>
            </Card>
          </section>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="size-4" />
                Backup history
              </CardTitle>
              <CardDescription>
                {history.length === 0
                  ? "Up to 8 recent snapshots stored in this browser."
                  : `${history.length} snapshot${history.length === 1 ? "" : "s"} · restore or delete as needed.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No snapshots yet. Export a backup to create your first history entry.
                </p>
              ) : (
                <div className="divide-y divide-border rounded-xl border border-border">
                  {history.map((snapshot) => (
                    <div
                      key={snapshot.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-4"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{snapshot.label}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatRelativeTime(snapshot.createdAt)}</span>
                          <span>·</span>
                          <span>{snapshot.keyCount} keys</span>
                          <span>·</span>
                          <span>{formatBackupSize(snapshot.sizeBytes)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRestoreTarget(snapshot)}
                        >
                          <RotateCcw className="size-4" />
                          Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteTarget(snapshot)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Included data keys</CardTitle>
              <CardDescription>
                These keys are included in exports when present in the browser.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {knownStorageKeys.map((key) => (
                <Badge key={key} variant="secondary" className="font-mono text-xs">
                  {key}
                </Badge>
              ))}
              <Badge variant="outline" className="font-mono text-xs">
                bakery-cms-* (all matching keys)
              </Badge>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={Boolean(restoreTarget)} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore this backup?</DialogTitle>
            <DialogDescription>
              This will overwrite matching local storage keys with the snapshot from{" "}
              <strong>{restoreTarget?.label}</strong>. Export current data first if you need a
              rollback.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setRestoreTarget(null)}>
              Cancel
            </Button>
            <Button variant="bakery" onClick={confirmRestore}>
              Restore snapshot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete snapshot?</DialogTitle>
            <DialogDescription>
              Remove <strong>{deleteTarget?.label}</strong> from backup history. Downloaded JSON
              files are not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
