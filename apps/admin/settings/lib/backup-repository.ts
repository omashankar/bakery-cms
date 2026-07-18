import type { BackupSnapshot } from "@/types/backup";
import { exportLocalStorageBackup, importLocalStorageBackup } from "@/features/settings/lib/settings-repository";

const STORAGE_KEY = "bakery-cms-backup-history";
const MAX_SNAPSHOTS = 8;
export const BACKUP_UPDATED_EVENT = "bakery-backup-updated";

function nowIso(): string {
  return new Date().toISOString();
}

function notify(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(BACKUP_UPDATED_EVENT));
}

function persist(snapshots: BackupSnapshot[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
  notify();
}

export function loadBackupHistory(): BackupSnapshot[] {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as BackupSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function estimateSize(data: Record<string, string | null>): number {
  return JSON.stringify(data).length;
}

export function createBackupSnapshot(
  data: Record<string, string | null>,
  label?: string
): BackupSnapshot {
  const snapshot: BackupSnapshot = {
    id: `backup-${Date.now()}`,
    label: label ?? `Backup ${new Date().toLocaleString()}`,
    createdAt: nowIso(),
    keyCount: Object.keys(data).length,
    sizeBytes: estimateSize(data),
    data,
  };

  const history = [snapshot, ...loadBackupHistory()].slice(0, MAX_SNAPSHOTS);
  persist(history);
  return snapshot;
}

export function deleteBackupSnapshot(id: string): boolean {
  const history = loadBackupHistory();
  const next = history.filter((item) => item.id !== id);
  if (next.length === history.length) return false;
  persist(next);
  return true;
}

export function restoreBackupSnapshot(id: string): number {
  const snapshot = loadBackupHistory().find((item) => item.id === id);
  if (!snapshot) return 0;
  return importLocalStorageBackup(snapshot.data);
}

export function exportAndArchiveBackup(label?: string): BackupSnapshot {
  const data = exportLocalStorageBackup();
  return createBackupSnapshot(data, label);
}

export function formatBackupSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
