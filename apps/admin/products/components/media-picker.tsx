"use client";

import { useMemo, useState, useEffect } from "react";
import { ImageIcon, Search } from "lucide-react";
import { loadMediaFiles, MEDIA_UPDATED_EVENT } from "@/apps/admin/media/lib/media-repository";
import { SafeImage } from "@/components/shared/safe-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface MediaPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
  /**
   * What the chosen image is for. Defaults to neutral copy — this dialog is
   * shared by banners, SEO, testimonials and the builders, so it must not
   * assume the caller is editing a cake.
   */
  description?: string;
}

export function MediaPicker({
  open,
  onOpenChange,
  onSelect,
  description = "Select an image. Upload new files from the Media Library page.",
}: MediaPickerProps) {
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const files = useMemo(() => {
    const query = search.trim().toLowerCase();
    return loadMediaFiles().filter((file) => {
      if (!query) return true;
      return (
        file.name.toLowerCase().includes(query) ||
        file.alt?.toLowerCase().includes(query)
      );
    });
  }, [open, search, refreshKey]);

  useEffect(() => {
    if (!open) return;
    function handleMediaUpdated() {
      setRefreshKey((value) => value + 1);
    }
    window.addEventListener(MEDIA_UPDATED_EVENT, handleMediaUpdated);
    return () => window.removeEventListener(MEDIA_UPDATED_EVENT, handleMediaUpdated);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose from Media Library</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search media..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {files.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            <ImageIcon className="mx-auto mb-2 size-5" />
            No media files found.
          </div>
        ) : (
          <div className="grid max-h-80 gap-3 overflow-y-auto sm:grid-cols-3">
            {files.map((file) => (
              <button
                key={file.id}
                type="button"
                className="overflow-hidden rounded-lg border border-border text-left transition-colors hover:border-primary/40 hover:bg-muted"
                onClick={() => {
                  onSelect(file.url);
                  onOpenChange(false);
                }}
              >
                <div className="relative aspect-square bg-muted">
                  <SafeImage src={file.url} alt={file.alt || file.name} className="object-cover" />
                </div>
                <p className="truncate px-2 py-2 text-xs font-medium">{file.name}</p>
              </button>
            ))}
          </div>
        )}

        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
