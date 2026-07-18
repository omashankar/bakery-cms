"use client";

import { useRef, useState } from "react";
import { ImagePlus, Link2, Upload } from "lucide-react";
import { toast } from "sonner";
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
import { addMediaFile } from "../lib/media-repository";
import { fileNameFromUrl, isPersistableMediaUrl } from "../lib/media-utils";
import { fixBrokenImageUrl } from "@/constants/demo-images";
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

  function createFromUrl(imageUrl: string, name?: string, size = 220_000) {
    const trimmed = imageUrl.trim();
    if (!trimmed) {
      toast.error("Enter an image URL");
      return;
    }

    const normalizedUrl = fixBrokenImageUrl(trimmed);
    if (!isPersistableMediaUrl(normalizedUrl) && !normalizedUrl.startsWith("data:")) {
      toast.error("Enter a valid image URL");
      return;
    }

    const file = addMediaFile({
      name: name ?? fileNameFromUrl(normalizedUrl),
      url: normalizedUrl,
      type: "image",
      mimeType: "image/jpeg",
      size,
      alt: "",
      width: 1200,
      height: 1200,
    });

    onUploaded(file);
    toast.success("Image added to media library");
    onOpenChange(false);
    reset();
  }

  function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are supported in this demo");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") return;
      createFromUrl(dataUrl, file.name, file.size);
    };
    reader.onerror = () => toast.error("Could not read image file");
    reader.readAsDataURL(file);
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
            Drag and drop an image or paste a URL. Files are stored locally in this demo.
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
            handleFiles(event.dataTransfer.files);
          }}
        >
          <ImagePlus className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drag & drop image here</p>
          <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, WEBP up to 10 MB (demo)</p>
          <Button className="mt-4" variant="outline" onClick={() => inputRef.current?.click()}>
            <Upload className="size-4" />
            Browse files
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handleFiles(event.target.files)}
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
            <Button variant="outline" className="shrink-0" onClick={() => createFromUrl(url)}>
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
