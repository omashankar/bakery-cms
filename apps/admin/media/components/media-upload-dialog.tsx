"use client";

import { useRef, useState } from "react";
import { ImagePlus, Link2, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useMediaUpload } from "../lib/use-media-upload";
import type { MediaFile } from "@/types/media";

interface MediaUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: (file: MediaFile) => void;
}

export function MediaUploadDialog({ open, onOpenChange, onUploaded }: MediaUploadDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  function reset() {
    setUrl("");
    setIsDragging(false);
  }

  const { isUploading, progress, addFromUrl, uploadFiles } = useMediaUpload({
    // Only hand the file up. Closing HERE dismissed the dialog as soon as photo
    // one landed, so choosing twelve tore down the progress counter and left
    // eleven uploads running behind a closed dialog with nothing reporting them.
    onAdded: onUploaded,
  });

  /** Close once the WHOLE batch is done, and only if something was added. */
  async function handleFiles(files: FileList | File[] | null) {
    const result = await uploadFiles(files);
    if (result && result.added > 0) {
      onOpenChange(false);
      reset();
    }
  }

  async function handleUrl() {
    const added = await addFromUrl(url);
    if (added) {
      onOpenChange(false);
      reset();
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Media</DialogTitle>
          <DialogDescription>
            Drag and drop an image or paste a URL.
          </DialogDescription>
        </DialogHeader>

        <div
          className={`rounded-xl border border-dashed p-8 text-center transition-colors ${
            isDragging ? "border-primary bg-primary/10" : "border-border bg-muted"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            void handleFiles(event.dataTransfer.files);
          }}
        >
          <ImagePlus className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drag & drop your photos here</p>
          <p className="mt-1 text-xs text-muted-foreground">
            PNG, JPG or WEBP — phone photos are resized automatically
          </p>
          <Button
            className="mt-4"
            variant="outline"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {isUploading
              ? progress && progress.total > 1
                ? `Uploading ${progress.done}/${progress.total}…`
                : "Uploading…"
              : "Browse files"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              void handleFiles(event.target.files);
              // Without this, choosing the SAME file again is not a change
              // event, so a retry after a failed upload does nothing at all.
              event.target.value = "";
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="image-url">Or paste image URL</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="image-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://images.unsplash.com/..."
            />
            <Button
              variant="outline"
              className="shrink-0"
              disabled={isUploading}
              onClick={() => void handleUrl()}
            >
              <Link2 className="size-4" />
              Add
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
