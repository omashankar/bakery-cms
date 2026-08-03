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
import { AdminPage, AdminPageHeader } from "@/apps/admin/components";
import { formatRelativeTime } from "@/utils/format";
import type { BackupSnapshot } from "@/types/backup";
import { knownStorageKeys } from "@/features/settings/lib/settings-utils";
import {
  BACKUP_UPDATED_EVENT,
  BROWSER_ONLY_NOTE,
  deleteBackupSnapshot,
  exportAndArchiveServerBackup,
  formatBackupSize,
  loadBackupHistory,
  restoreBackupToServer,
  type RestoreResult,
  restoreBackupSnapshotToServer,
  serverBackedKeys,
} from "../lib/backup-repository";

export function BackupSettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [history, setHistory] = useState<BackupSnapshot[]>([]);
  const [backupLabel, setBackupLabel] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<BackupSnapshot | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BackupSnapshot | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    fileName: string;
    data: Record<string, string | null>;
    keyCount: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function handleExport() {
    setBusy(true);
    try {
      // Reads the CURRENT server (Mongo) state for every server-backed slice,
      // falling back to localStorage — so the file reflects the durable data.
      const { snapshot, unavailableSections } = await exportAndArchiveServerBackup(
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

      // Says which slices are NOT the server's copy.
      //
      // A failed read falls back silently to whatever this browser held — the
      // demo seed on a cold or signed-out load — and the file was still called
      // a server backup. That file gets restored months later, over the real
      // thing, by someone with no way left to tell which slices were ever real.
      if (unavailableSections.length > 0) {
        toast.warning(`Exported ${snapshot.keyCount} keys — but not all from the server`, {
          description: `Could not read ${unavailableSections.join(", ")}. Those came from this browser instead. Reload and export again before relying on this file.`,
        });
        return;
      }

      toast.success(`Exported and archived ${snapshot.keyCount} data keys`);
    } catch {
      toast.error("Export failed — please try again");
    } finally {
      setBusy(false);
    }
  }

  /** Parses and validates only — the write happens in confirmImport. */
  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onerror = () => toast.error("Could not read that file");
    reader.onload = () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch {
        toast.error("Invalid backup file — not valid JSON");
        return;
      }

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        toast.error("Invalid backup file — expected a backup object");
        return;
      }

      const data = parsed as Record<string, string | null>;
      // Mirror importLocalStorageBackup's own filter so the count we show is the count it writes.
      const keyCount = Object.keys(data).filter(
        (key) => key.startsWith("bakery-cms") && data[key] !== null
      ).length;

      if (keyCount === 0) {
        toast.error("No CMS data found in that file");
        return;
      }

      setPendingImport({ fileName: file.name, data, keyCount });
    };
    reader.readAsText(file);
  }

  async function confirmImport() {
    if (!pendingImport) return;
    const target = pendingImport;
    setPendingImport(null);
    setBusy(true);
    try {
      // Snapshot the current DURABLE state (server + local) BEFORE the write, so
      // rolling back from history actually restores the server too.
      await exportAndArchiveServerBackup(`Before import — ${new Date().toLocaleString()}`);
      const result = await restoreBackupToServer(target.data);
      refresh();
      reportRestore(result);
    } catch {
      toast.error("Import failed — please try again");
    } finally {
      setBusy(false);
    }
  }

  /**
   * A restore is exactly when an admin is least able to check by eye. Listing a
   * section the server refused is how a backup gets trusted that never came back.
   */
  function reportRestore(result: RestoreResult) {
    if (result.failedSections.length > 0) {
      toast.error(
        `Restored ${result.serverSections.length} of ${result.serverSections.length + result.failedSections.length} sections to the server`,
        {
          description: `The server refused: ${result.failedSections.join(", ")}. Those are restored in this browser only.`,
        }
      );
      return;
    }

    toast.success(
      `Restored ${result.localCount} keys locally and pushed ${result.serverSections.length} sections to the server`
    );
  }

  async function confirmRestore() {
    if (!restoreTarget) return;
    const target = restoreTarget;
    setRestoreTarget(null);
    setBusy(true);
    try {
      const result = await restoreBackupSnapshotToServer(target.id);
      refresh();
      if (result) {
        reportRestore(result);
      } else {
        toast.error("That snapshot could not be found");
      }
    } catch {
      toast.error("Restore failed — please try again");
    } finally {
      setBusy(false);
    }
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
        description="Export CMS data from the server, restore from a file back to the server, and keep a local backup history."
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
                  Reads the current server (database) state, downloads a JSON file, and saves a
                  snapshot to backup history.
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
                <Button variant="bakery" onClick={handleExport} disabled={busy}>
                  <Download className="size-4" />
                  Download &amp; archive
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Import backup</CardTitle>
                <CardDescription>
                  Upload a JSON backup file. Server-backed sections are pushed to the database so
                  the restore survives reload. A safety snapshot is created first.
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
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                >
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
                      <div className="min-w-0 space-y-1">
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
                          aria-label={`Delete ${snapshot.label}`}
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
                Keys marked <span className="font-medium text-foreground">server</span> restore to
                the database and survive reload. The rest restore to this browser only.{" "}
                {BROWSER_ONLY_NOTE}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {knownStorageKeys.map((key) => {
                const isServer = serverBackedKeys.includes(key);
                return (
                  <Badge
                    key={key}
                    variant={isServer ? "bakery" : "secondary"}
                    className="font-mono text-xs"
                    title={isServer ? "Synced to the database" : "Browser-only"}
                  >
                    {key}
                    {isServer ? " · server" : ""}
                  </Badge>
                );
              })}
              <Badge variant="outline" className="font-mono text-xs">
                bakery-cms-* (all matching keys)
              </Badge>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog
        open={Boolean(pendingImport)}
        onOpenChange={(open) => !open && setPendingImport(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import this backup?</DialogTitle>
            <DialogDescription>
              <strong>{pendingImport?.fileName}</strong> contains {pendingImport?.keyCount} CMS
              data {pendingImport?.keyCount === 1 ? "key" : "keys"}. Server-backed sections are
              pushed to the database (so they survive reload); the rest overwrite this browser. A
              snapshot of your current data is archived first, so you can roll back from history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setPendingImport(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="bakery" onClick={confirmImport} disabled={busy}>
              Import backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(restoreTarget)} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore this backup?</DialogTitle>
            <DialogDescription>
              This restores the snapshot from <strong>{restoreTarget?.label}</strong>:
              server-backed sections are pushed to the database and the rest overwrite this
              browser. Export current data first if you need a rollback.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setRestoreTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="bakery" onClick={confirmRestore} disabled={busy}>
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
