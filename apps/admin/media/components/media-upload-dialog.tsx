"use client";

import { useRef, useState } from "react";
import { ImagePlus, Link2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { reportWrite } from "@/apps/admin/lib/report-write";
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
import { uploadMediaRequest } from "../lib/media-api";
import { fileNameFromUrl, isPersistableMediaUrl } from "../lib/media-utils";
import { fixBrokenImageUrl } from "@/constants/demo-images";
import type { MediaFile } from "@/types/media";

/** With an image host configured, the file is sent there rather than stored inline. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Without one, the image is kept as base64 in localStorage AND in a single
 * Mongo document. Base64 adds about a third, browsers cap localStorage near
 * 5 MB and Mongo caps a document at 16 MB, so this has to stay small.
 */
const MAX_INLINE_BYTES = 400 * 1024;

interface MediaUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: (file: MediaFile) => void;
}

export function MediaUploadDialog({ open, onOpenChange, onUploaded }: MediaUploadDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  function reset() {
    setUrl("");
    setIsDragging(false);
    setIsUploading(false);
  }

  async function createFromUrl(
    imageUrl: string,
    name?: string,
    size?: number,
    publicId?: string,
    mimeType?: string
  ) {
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

    const { value: file, persisted } = await addMediaFile({
      name: name ?? fileNameFromUrl(normalizedUrl),
      url: normalizedUrl,
      // Nothing invented.
      //
      // A pasted URL used to be recorded as 220,000 bytes at 1200×1200 in
      // image/jpeg — none of it true, and all of it counted: the Storage stat
      // grew by a fictional 215 KB per entry and the dimensions were shown in the
      // detail panel as fact. What is not known is left unset.
      type: "image",
      mimeType: mimeType ?? "",
      size: size ?? 0,
      alt: "",
      publicId,
    });

    onUploaded(file);
    onOpenChange(false);
    reset();
    reportWrite(persisted, "Image added to media library");
  }

  function handleFiles(fileList: FileList | null) {
    if (isUploading) return;
    const file = fileList?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are supported");
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("That image is too large", {
        description: `Please keep uploads under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
      });
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") {
        setIsUploading(false);
        return;
      }
      try {
        // Upload to Cloudinary when configured; otherwise fall back to the data URI.
        const asset = await uploadMediaRequest(dataUrl);
        if (asset) {
          await createFromUrl(
            asset.url,
            file.name,
            asset.bytes ?? file.size,
            asset.publicId,
            file.type,
          );
          return;
        }

        // No Cloudinary: the whole image is stored inline, as base64, in this
        // browser's localStorage AND in one Mongo document. Base64 adds about a
        // third, browsers cap localStorage near 5 MB and a Mongo document at 16,
        // so a few phone photos take the library past both — the setItem throws,
        // the image vanishes and every later save fails too. Refused with a
        // reason instead.
        if (file.size > MAX_INLINE_BYTES) {
          toast.error("Image storage is not configured", {
            description: `Without an image host, uploads must stay under ${Math.round(
              MAX_INLINE_BYTES / 1024,
            )} KB. Add Cloudinary credentials, or paste a hosted image URL instead.`,
            duration: 10000,
          });
          return;
        }

        await createFromUrl(dataUrl, file.name, file.size, undefined, file.type);
      } catch (error) {
        // Previously a try/finally with no catch: a quota failure escaped as an
        // unhandled rejection, so the spinner stopped, the dialog stayed open,
        // and nothing at all told the admin their image had not been saved.
        toast.error(
          error instanceof Error && /quota/i.test(error.message)
            ? "This browser is out of storage for the media library"
            : "Could not add that image",
        );
      } finally {
        setIsUploading(false);
      }
    };
    reader.onerror = () => {
      toast.error("Could not read image file");
      setIsUploading(false);
    };
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
            handleFiles(event.dataTransfer.files);
          }}
        >
          <ImagePlus className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drag & drop image here</p>
          <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, WEBP up to 10 MB</p>
          <Button
            className="mt-4"
            variant="outline"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {isUploading ? "Uploading…" : "Browse files"}
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
            <Button
              variant="outline"
              className="shrink-0"
              disabled={isUploading}
              onClick={() => void createFromUrl(url)}
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
