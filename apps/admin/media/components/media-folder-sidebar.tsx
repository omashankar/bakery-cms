"use client";

import { Folder, FolderPlus, ImageIcon, Trash2 } from "lucide-react";
import { useState } from "react";
import { reportWrite } from "@/apps/admin/lib/report-write";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MediaFolder } from "@/types/media";
import { toast } from "sonner";
import {
  createMediaFolder,
  deleteMediaFolder,
  defaultMediaFolders,
  mediaFolderNameTaken,
  UPLOADS_FOLDER_ID,
} from "../lib/media-folders";
import { moveFilesToFolder } from "../lib/media-repository";
import { cn } from "@/lib/utils";

interface MediaFolderSidebarProps {
  folders: MediaFolder[];
  activeFolderId: string | "all";
  counts: Record<string, number>;
  onSelect: (folderId: string | "all") => void;
  onFoldersChange: () => void;
}

export function MediaFolderSidebar({
  folders,
  activeFolderId,
  counts,
  onSelect,
  onFoldersChange,
}: MediaFolderSidebarProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (mediaFolderNameTaken(trimmed)) {
      toast.error(`A folder called "${trimmed}" already exists`);
      return;
    }

    const { value: folder, persisted } = await createMediaFolder(trimmed);
    if (!folder) {
      toast.error("Could not create that folder");
      return;
    }
    setName("");
    setCreating(false);
    onFoldersChange();
    reportWrite(persisted, `Folder "${trimmed}" created`);
  }

  /**
   * Removing a folder must not orphan the files inside it.
   *
   * `deleteMediaFolder` existed and nothing could reach it — the sidebar offered
   * only a create button — so a folder created by mistake was permanent. Files
   * move to Uploads rather than being left pointing at a folder that is gone,
   * which the detail panel's folder picker would render as no selection at all.
   */
  async function handleDelete(folder: MediaFolder) {
    const moved = await moveFilesToFolder(folder.id, UPLOADS_FOLDER_ID);
    const { value: removed, persisted } = await deleteMediaFolder(folder.id);

    if (!removed) {
      toast.error("Built-in folders cannot be deleted");
      return;
    }

    setPendingDelete(null);
    if (activeFolderId === folder.id) onSelect("all");
    onFoldersChange();
    reportWrite(
      persisted,
      moved > 0
        ? `Folder deleted — ${moved} file${moved === 1 ? "" : "s"} moved to Uploads`
        : "Folder deleted",
    );
  }

  return (
    <aside className="rounded-xl border border-border bg-card p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Folders</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => setCreating((value) => !value)}
          aria-label="Create folder"
        >
          <FolderPlus className="size-4" />
        </Button>
      </div>

      {creating ? (
        <div className="mb-3 space-y-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Folder name"
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleCreate();
            }}
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" className="flex-1" onClick={() => void handleCreate()}>
              Create
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setName("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-1">
        <button
          type="button"
          onClick={() => onSelect("all")}
          className={cn(
            "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
            activeFolderId === "all" ? "bg-muted font-medium text-foreground" : "hover:bg-muted/60"
          )}
        >
          <span className="flex items-center gap-2">
            <ImageIcon className="size-4 text-muted-foreground" />
            All media
          </span>
          <span className="text-xs text-muted-foreground">{counts.all ?? 0}</span>
        </button>

        {folders.map((folder) => {
          const isBuiltIn = defaultMediaFolders.some((item) => item.id === folder.id);
          const confirming = pendingDelete === folder.id;

          return (
            <div key={folder.id} className="group/folder relative">
              <button
                type="button"
                onClick={() => onSelect(folder.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  activeFolderId === folder.id
                    ? "bg-muted font-medium text-foreground"
                    : "hover:bg-muted/60"
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Folder className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{folder.name}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {counts[folder.id] ?? 0}
                </span>
              </button>

              {!isBuiltIn && !confirming ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete folder ${folder.name}`}
                  className="absolute top-1/2 right-1 size-7 -translate-y-1/2 text-muted-foreground opacity-0 group-hover/folder:opacity-100 focus-visible:opacity-100"
                  onClick={() => setPendingDelete(folder.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ) : null}

              {confirming ? (
                <div className="mt-1 space-y-2 rounded-lg border border-border bg-muted/50 p-2">
                  <p className="text-xs text-muted-foreground">
                    Delete “{folder.name}”? Its files move to Uploads.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => void handleDelete(folder)}
                    >
                      Delete
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setPendingDelete(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
