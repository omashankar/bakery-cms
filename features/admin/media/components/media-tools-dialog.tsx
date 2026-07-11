"use client";

import { Copy, ImageDown, Layers2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MediaFile } from "@/types/media";
import { formatFileSize, type MediaDuplicateGroup } from "../lib/media-utils";
import { MediaThumbnail } from "./media-thumbnail";

interface MediaToolsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateGroups: MediaDuplicateGroup[];
  unusedCount: number;
  onSelectFile: (fileId: string) => void;
}

export function MediaToolsDialog({
  open,
  onOpenChange,
  duplicateGroups,
  unusedCount,
  onSelectFile,
}: MediaToolsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Media tools</DialogTitle>
          <DialogDescription>
            Duplicate finder and compression utilities for the media library.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3 rounded-xl border border-border p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-muted p-2">
              <ImageDown className="size-4 text-foreground" />
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium">Image compression</p>
              <p className="text-xs text-muted-foreground">
                Placeholder for future WebP conversion and size optimization. Backend image
                processing will plug in here.
              </p>
              <Button variant="outline" size="sm" disabled>
                Compress selected (coming soon)
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers2 className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium">Duplicate finder</p>
            </div>
            <Badge variant="secondary">{duplicateGroups.length} group(s)</Badge>
          </div>

          {duplicateGroups.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              No duplicate files detected by URL or similar filename.
            </p>
          ) : (
            <div className="space-y-3">
              {duplicateGroups.map((group) => (
                <div key={`${group.reason}-${group.key}`} className="rounded-xl border border-border p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {group.reason === "same-url" ? "Same URL" : "Similar name"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {group.files.length} files
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.files.map((file) => (
                      <DuplicateRow key={file.id} file={file} onSelect={onSelectFile} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="text-xs text-muted-foreground">
          {unusedCount} unused file{unusedCount === 1 ? "" : "s"} in the library. Use the usage
          filter to review them.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function DuplicateRow({
  file,
  onSelect,
}: {
  file: MediaFile;
  onSelect: (fileId: string) => void;
}) {
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(file.url);
      toast.success("URL copied");
    } catch {
      toast.error("Could not copy URL");
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-2">
      <div className="relative size-10 overflow-hidden rounded-md border border-border bg-muted">
        <MediaThumbnail src={file.url} alt={file.name} className="object-cover" sizes="40px" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
      </div>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={copyUrl}>
          <Copy className="size-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => onSelect(file.id)}>
          Open
        </Button>
      </div>
    </div>
  );
}
