"use client";

import { useRef, useState } from "react";
import { Camera, ChevronDown, ImageIcon, Loader2, Trash2 } from "lucide-react";

import { MediaPicker } from "@/apps/admin/products/components/media-picker";
import { SafeImage } from "@/components/shared/safe-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isForeignImageHost } from "@/lib/images/image-hosts";
import { cn } from "@/lib/utils";
import { useMediaUpload } from "../lib/use-media-upload";

interface PhotoFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Placeholder for the URL box, which lives under Advanced. */
  placeholder?: string;
  /** Shape of the preview. A logo, a banner and a cake are not the same shape. */
  aspect?: "video" | "square" | "wide";
  /**
   * A validation message from the caller.
   *
   * Setting it also OPENS Advanced: the only thing that can be invalid here is
   * the URL, and reporting an error about a box the admin cannot see is how a
   * form becomes unfixable.
   */
  error?: string;
}

const ASPECT: Record<NonNullable<PhotoFieldProps["aspect"]>, string> = {
  video: "aspect-video",
  square: "aspect-square max-w-[12rem]",
  wide: "aspect-[3/1]",
};

/** The hostname, for a message about where a picture is being loaded from. */
function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * How a shop owner puts a picture on their website.
 *
 * This replaced a bare `https://...` text box with a "Media" button beside it.
 * That ordering had the field asking for the one thing its user does not have:
 * the person adding a cake is usually standing in the shop, on a phone, with
 * the photograph in their camera roll — and a URL is a concept from a different
 * job. Most of them typed nothing at all, or pasted a link from an image search
 * that then broke the page.
 *
 * So the picture comes first and is the whole control: tapping the box opens
 * the phone's gallery or camera directly. The URL box still exists, because
 * some shops really do host images elsewhere, but it is folded away under
 * Advanced where it cannot be mistaken for the main path.
 *
 * Three ways in, because people arrive with the photo in three different
 * places: the file picker, a drag from the desktop, and Ctrl+V for the
 * screenshot they just took. All three land on the same upload, which resizes
 * before sending — see lib/images/shrink-image.ts.
 */
export function PhotoField({
  id,
  label,
  value,
  onChange,
  placeholder,
  aspect = "video",
  error,
}: PhotoFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  /**
   * null = "nobody has touched this", so an error can open the panel while the
   * admin keeps the ability to close it again. Bound to `showAdvanced`
   * directly, the toggle wrote a value nothing read: with an error present the
   * panel was forced open, so pressing Advanced did visibly nothing.
   */
  const [advancedChoice, setAdvancedChoice] = useState<boolean | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { isUploading, uploadFiles } = useMediaUpload({
    onAdded: (file) => onChange(file.url),
  });

  // Derived, not synced: an effect that opened the panel when `error` appeared
  // would also slam it shut the moment the admin fixed the value mid-typing.
  const showAdvanced = advancedChoice ?? Boolean(error);

  const trimmed = value.trim();

  /**
   * A note, deliberately not a block. The render layer is safe — a foreign host
   * is served unoptimised rather than throwing — so refusing the value would
   * strand a shop mid-edit to prevent something that no longer breaks.
   *
   * Asks `isForeignImageHost`, NOT `classifyImageSrc(...) === "as-is"`. The
   * latter is also true for our own SVGs, which next/image serves unoptimised
   * by design — so a shop that uploaded an SVG logo was told, about a file now
   * sitting in their own Cloudinary account, that it came from somewhere else.
   */
  const foreignHost = isForeignImageHost(trimmed) ? hostOf(trimmed) : null;

  function choose() {
    if (!isUploading) inputRef.current?.click();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setAdvancedChoice(!showAdvanced)}
          aria-expanded={showAdvanced}
          aria-controls={`${id}-advanced`}
        >
          Advanced
          <ChevronDown className={cn("size-3 transition-transform", showAdvanced && "rotate-180")} />
        </button>
      </div>

      {/*
        A button, not a div with a click handler: this is the primary control of
        the field, so it has to be reachable by keyboard and announce itself.
      */}
      <button
        type="button"
        id={id}
        onClick={choose}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void uploadFiles(event.dataTransfer.files);
        }}
        onPaste={(event) => {
          const image = Array.from(event.clipboardData.items).find((item) =>
            item.type.startsWith("image/"),
          );
          const file = image?.getAsFile();
          if (file) {
            event.preventDefault();
            void uploadFiles([file]);
          }
        }}
        className={cn(
          "relative w-full overflow-hidden rounded-xl border-2 border-dashed transition-colors",
          ASPECT[aspect],
          isDragging
            ? "border-primary bg-primary/10"
            : "border-border bg-muted/40 hover:border-primary/40 hover:bg-muted",
        )}
      >
        {trimmed && !isUploading ? (
          <SafeImage src={trimmed} alt={label} className="object-cover" />
        ) : null}

        {isUploading ? (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/80 text-sm text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            Uploading…
          </span>
        ) : !trimmed ? (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center">
            <Camera className="size-7 text-muted-foreground" />
            <span className="text-sm font-medium">Add a photo</span>
            <span className="text-xs text-muted-foreground">
              Tap to choose from this device, or drop one here
            </span>
          </span>
        ) : null}
      </button>

      {/*
        `capture` is deliberately absent. On a phone `accept="image/*"` already
        offers the camera alongside the gallery, and adding `capture` would
        force the camera and take the gallery away — which is where the
        photograph usually already is.
      */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void uploadFiles(event.target.files);
          // Without this, choosing the SAME file again is not a change event,
          // so a retry after a failed upload does nothing at all.
          event.target.value = "";
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={isUploading} onClick={choose}>
          <Camera className="size-4" />
          {trimmed ? "Replace" : "Upload"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUploading}
          onClick={() => setPickerOpen(true)}
        >
          <ImageIcon className="size-4" />
          Library
        </Button>
        {trimmed ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => onChange("")}
          >
            <Trash2 className="size-4" />
            Remove
          </Button>
        ) : null}
      </div>

      {foreignHost ? (
        /*
          States the consequence and stops there. It used to end "Press Upload
          to keep a copy in your own library" — but Upload opens the device's
          file picker, and the picture in question is on somebody else's server,
          so that instruction could not be followed.
        */
        <p className="text-xs text-muted-foreground">
          This picture loads from {foreignHost}. It will still show, but it cannot be optimised and
          will disappear if that site removes it.
        </p>
      ) : null}

      {error ? (
        // role="alert" and the id below restore what <FieldError> gave these
        // fields before the migration: the message is spoken when it appears,
        // and is reachable from the input it belongs to.
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {showAdvanced ? (
        <div id={`${id}-advanced`} className="space-y-1 pt-1">
          <label htmlFor={`${id}-url`} className="text-xs text-muted-foreground">
            Image URL
          </label>
          <Input
            id={`${id}-url`}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder ?? "https://..."}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            className={cn(error && "border-destructive")}
          />
        </div>
      ) : null}

      <MediaPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={onChange} />
    </div>
  );
}
