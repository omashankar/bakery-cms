"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { ImageIcon, Loader2, Search, Upload } from "lucide-react";
import { loadMediaFiles, MEDIA_UPDATED_EVENT } from "@/apps/admin/media/lib/media-repository";
import { useMediaUpload } from "@/apps/admin/media/lib/use-media-upload";
import { SafeImage } from "@/components/shared/safe-image";
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
  description = "Choose an image, or drop a new one in to upload it.",
}: MediaPickerProps) {
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Dragging over a child fires dragleave on the parent, so a plain boolean
  // flickers the overlay off the moment the pointer crosses a tile.
  const dragDepth = useRef(0);

  // Closing while a drag is in flight never delivers a drop, so the overlay
  // and its depth counter have to be cleared on every path out of here.
  function closePicker() {
    dragDepth.current = 0;
    setIsDragging(false);
    onOpenChange(false);
  }

  /**
   * Every url added while this dialog has been open, in order.
   *
   * A single "first added" ref could not survive a second drop: it was cleared
   * at the start of each call, but `uploadFiles` DECLINES while a batch is
   * running, so the second drop wiped the running batch's marker and the picker
   * then selected whichever photo happened to land next. Recording a list and
   * remembering where this call started cannot get that wrong.
   */
  const addedUrls = useRef<string[]>([]);

  const { isUploading, progress, uploadFiles } = useMediaUpload({
    onAdded: (file) => {
      addedUrls.current.push(file.url);
    },
  });

  /**
   * Uploading here IS the choice — the admin opened this to fill a field, so
   * making them find the new file in the grid afterwards would put back the
   * step this dialog exists to remove. The FIRST image of a batch fills the
   * field; the rest simply join the library.
   */
  async function handleFiles(files: FileList | File[] | null) {
    const start = addedUrls.current.length;
    const result = await uploadFiles(files);
    // null means it declined because another batch is already running; that
    // batch will do the selecting.
    if (!result) return;

    const first = addedUrls.current[start];
    if (first) {
      onSelect(first);
      closePicker();
    }
  }

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
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : closePicker())}
    >
      <DialogContent
        className="sm:max-w-2xl"
        // This dialog is opened from PhotoField, which usually lives inside
        // another dialog (a banner, a testimonial, a catalogue category). Left
        // to itself base-ui would suppress the dim as "nested", and the form
        // behind would stay fully lit while being unreachable.
        forceBackdrop
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepth.current += 1;
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setIsDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
      >
        <DialogHeader>
          <DialogTitle>Choose an image</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search media..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {isUploading
              ? progress && progress.total > 1
                ? `${progress.done}/${progress.total}`
                : "Uploading…"
              : "Upload"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            // A shop putting twelve cakes online should choose twelve photos
            // once, not repeat the whole cycle twelve times.
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

        {isDragging ? (
          <div className="rounded-lg border-2 border-dashed border-primary bg-primary/10 px-4 py-10 text-center text-sm font-medium text-primary">
            <Upload className="mx-auto mb-2 size-5" />
            Drop your photos to upload them
          </div>
        ) : files.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            <ImageIcon className="mx-auto mb-2 size-5" />
            {search.trim() ? (
              "No media files match that search."
            ) : (
              <>
                No images yet. Drag one here, or press Upload.
                <span className="mt-1 block text-xs">
                  PNG, JPG or WEBP — phone photos are resized automatically
                </span>
              </>
            )}
          </div>
        ) : (
          /**
           * The height cap belongs on a PLAIN BOX, never on the grid itself.
           *
           * As one element this was `grid max-h-80 overflow-y-auto`, and every
           * tile rendered as a ~13px strip. Two rules meet badly there. The tile
           * carries `overflow-hidden`, which makes it a scroll container, and a
           * scroll container's automatic minimum size is 0 rather than its
           * content height (CSS Grid §6.6) — so each implicit row's base size is
           * 0. The cap then gives the grid a finite amount of free space, which
           * "Maximize Tracks" (§12.6) shares out EQUALLY across the rows: 320px
           * over thirteen rows is 13px each, nowhere near the 237px a tile
           * wants. The thumbnail stays a full square; the button around it is
           * 13px and clips it to a sliver.
           *
           * It scrolled fine with three images or fewer, which is one row and no
           * free space to misdistribute — which is why it shipped looking right.
           * And the giveaway was that the box never scrolled: every row had been
           * FITTED inside it, so there was nothing to scroll to.
           *
           * A block with max-height leaves its in-flow grid child's block size
           * indefinite, so rows land on their growth limits and the box
           * genuinely overflows — which is what makes the scrollbar work.
           *
           * Structural, deliberately, rather than a track-sizing class like
           * `auto-rows-min`: that would make each row a min-content track, and a
           * min-content height for a box whose only child is absolutely
           * positioned rests on aspect-ratio transfer — the same order of
           * subtlety that caused this. What is below is instead the exact shape
           * of the Media Library grid (media-library-page.tsx), which renders
           * correctly today with ordinary `auto` rows and no cap of its own.
           */
          <div className="panel-scroll max-h-80 overflow-y-auto">
            <div className="grid gap-3 sm:grid-cols-3">
              {files.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  className="overflow-hidden rounded-lg border border-border text-left transition-colors hover:border-primary/40 hover:bg-muted"
                  onClick={() => {
                    onSelect(file.url);
                    closePicker();
                  }}
                >
                  <div className="relative aspect-square bg-muted">
                    <SafeImage src={file.url} alt={file.alt || file.name} className="object-cover" />
                  </div>
                  <p className="truncate px-2 py-2 text-xs font-medium">{file.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={closePicker}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
