"use client";

import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminSelect, adminTextareaClassName } from "@/features/admin/products/components/admin-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/utils/format";
import {
  getMediaUsageDetails,
  updateMediaFile,
} from "../lib/media-repository";
import { loadMediaFolders } from "../lib/media-folders";
import { formatFileSize } from "../lib/media-utils";
import type { MediaFile } from "@/types/media";
import { MediaThumbnail } from "./media-thumbnail";

interface MediaDetailPanelProps {
  file: MediaFile | null;
  onUpdate: (file: MediaFile) => void;
  onDelete: (file: MediaFile) => void;
}

export function MediaDetailPanel({ file, onUpdate, onDelete }: MediaDetailPanelProps) {
  if (!file) {
    return (
      <div className="flex h-full min-h-64 flex-col">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">File details</p>
          <p className="text-xs text-muted-foreground">No file selected</p>
        </div>
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Select a file to view details, edit alt text, or copy its URL.
        </div>
      </div>
    );
  }

  const current = file;
  const usage = getMediaUsageDetails(current.url);
  const folders = loadMediaFolders();

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(current.url);
      toast.success("URL copied to clipboard");
    } catch {
      toast.error("Could not copy URL");
    }
  }

  function saveField(patch: Partial<MediaFile>) {
    const updated = updateMediaFile(current.id, patch);
    if (updated) onUpdate(updated);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <p className="truncate text-sm font-semibold">{current.name}</p>
        <p className="text-xs text-muted-foreground">Alt text, folder, metadata, and actions</p>
      </div>

      <div className="panel-scroll min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
        <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
          <MediaThumbnail
            src={current.url}
            alt={current.alt || current.name}
            className="object-cover"
            sizes="320px"
          />
        </div>

        <div className="space-y-3 text-sm">
          <div className="space-y-2">
            <Label htmlFor="file-name">Filename</Label>
            <Input
              id="file-name"
              defaultValue={current.name}
              onBlur={(event) => saveField({ name: event.target.value.trim() || current.name })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file-folder">Folder</Label>
            <AdminSelect
              id="file-folder"
              value={current.folderId ?? ""}
              onChange={(event) => saveField({ folderId: event.target.value })}
            >
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </AdminSelect>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Type</p>
              <p className="capitalize">{current.type}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Size</p>
              <p>{formatFileSize(current.size)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dimensions</p>
              <p>
                {current.width && current.height
                  ? `${current.width} × ${current.height}`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Used in</p>
              <p>
                {usage.length} place{usage.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Uploaded</p>
            <p>{formatDate(current.createdAt)}</p>
          </div>
        </div>

        {usage.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Usage</p>
            <div className="flex flex-wrap gap-2">
              {usage.map((ref) => (
                <Badge
                  key={`${ref.context}-${ref.label}`}
                  variant="outline"
                  className="text-xs"
                >
                  {ref.context}: {ref.label}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Not referenced in cakes, banners, or builders yet.
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="alt-text">Alt text</Label>
          <Input
            id="alt-text"
            defaultValue={current.alt ?? ""}
            placeholder="Describe this image for accessibility"
            onBlur={(event) => saveField({ alt: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="caption-text">Caption</Label>
          <textarea
            id="caption-text"
            className={adminTextareaClassName}
            rows={2}
            defaultValue={current.caption ?? ""}
            placeholder="Optional caption for galleries or content blocks"
            onBlur={(event) => saveField({ caption: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="media-tags">Tags</Label>
          <Input
            id="media-tags"
            defaultValue={(current.tags ?? []).join(", ")}
            placeholder="hero, wedding, promo (comma separated)"
            onBlur={(event) => {
              const tags = event.target.value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean);
              saveField({ tags });
            }}
          />
          {(current.tags ?? []).length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {(current.tags ?? []).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={copyUrl}>
            <Copy className="size-4" />
            Copy URL
          </Button>
          <Button variant="destructive" onClick={() => onDelete(current)}>
            <Trash2 className="size-4" />
            Delete file
          </Button>
        </div>
      </div>
    </div>
  );
}
