"use client";

import { Folder, FolderPlus, ImageIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MediaFolder } from "@/types/media";
import { createMediaFolder } from "../lib/media-folders";
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

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    createMediaFolder(trimmed);
    setName("");
    setCreating(false);
    onFoldersChange();
    toast.success(`Folder "${trimmed}" created`);
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
              if (event.key === "Enter") handleCreate();
            }}
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" className="flex-1" onClick={handleCreate}>
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

        {folders.map((folder) => (
          <button
            key={folder.id}
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
            <span className="text-xs text-muted-foreground">{counts[folder.id] ?? 0}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
