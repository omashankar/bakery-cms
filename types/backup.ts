export interface BackupSnapshot {
  id: string;
  label: string;
  createdAt: string;
  keyCount: number;
  sizeBytes: number;
  /** Full localStorage payload for demo restore */
  data: Record<string, string | null>;
}
