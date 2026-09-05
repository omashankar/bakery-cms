"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImageUp, RotateCcw } from "lucide-react";

import { OptimizedImage } from "@/components/shared/optimized-image";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  charactersLeft,
  emptyPhotoPrintDraft,
  frameShape,
  frameSize,
  MAX_CHOSEN_BYTES,
  NAME_LIMIT,
  OUTPUT_PX,
  paintPhotoFrame,
  photoFileProblem,
  type FramePainter,
  PHOTO_RANGES,
  PREVIEW_PX,
  type PhotoPrintDraft,
} from "@/lib/images/photo-print-layout";
import type { PhotoFrameShapeId } from "@/types/product";
import { cn } from "@/lib/utils";

interface PhotoPrintEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The customer's own file, held here and never sent as-is. */
  file: File | null;
  onFileChange: (file: File | null) => void;
  draft: PhotoPrintDraft;
  onDraftChange: (draft: PhotoPrintDraft) => void;
  /**
   * The outline this product is printed inside, as the shop set it.
   *
   * Absent means round — what every photo product printed before there was
   * a choice — so a shop that never opens the new picker sees no change.
   */
  shape?: PhotoFrameShapeId;
  /** True while the shop is being sent the finished frame. */
  busy: boolean;
  /** Hand over the flattened frame. The caller uploads it and closes this. */
  onUse: (file: File) => void;
  /**
   * The photo the shop ALREADY has for this line, if any.
   *
   * Only what was uploaded survives — not the original file, not where the
   * sliders were — so somebody who comes back to a line they saved opens
   * this on an empty circle while the button behind it says a photo is
   * attached. Showing the one that is attached is the difference between
   * that reading as a starting point and reading as a loss.
   */
  attachedUrl?: string;
  /** Anything the customer needs told — a file too big, a photo that will not open. */
  onProblem: (message: string) => void;
}

/**
 * Fit a photograph, and a name, into the round area that gets printed.
 *
 * The control this replaces was a bare file input: choose a file and it went
 * straight to the shop at whatever size and crop the camera happened to give.
 * Nobody could see what would be printed, a portrait photograph was silently
 * cropped by whatever the shop's own printer decided, and a name had to go in
 * the free-text message box and be set by hand at the other end.
 *
 * What leaves here is ONE flattened square JPEG — the picture and the
 * lettering already composed. That is the whole reason there is no new field
 * on the cart line, the order, the quote validator or the invoice: the shop
 * receives a thing to print, not a set of instructions to follow, and the nine
 * hand-written field lists between this page and a saved order stay exactly as
 * they are.
 *
 * The cost of that choice, stated plainly: the original photograph and these
 * slider positions are NOT kept. Coming back to change it starts again. That
 * is the same bargain the reference storefronts make, and the alternative is a
 * styling record travelling through every one of those lists to be re-rendered
 * by something that does not exist yet.
 */
export function PhotoPrintEditor({
  open,
  onOpenChange,
  file,
  onFileChange,
  draft,
  onDraftChange,
  shape,
  busy,
  attachedUrl,
  onUse,
  onProblem,
}: PhotoPrintEditorProps) {
  /**
   * The canvas ELEMENT, held as state rather than in a ref.
   *
   * A closed dialog is unmounted, so every open builds a brand-new canvas —
   * and an effect keyed on `[image, draft]` does not re-run for it, because
   * neither changed. Pressing “Change photo or name” therefore opened onto a
   * BLANK WHITE CIRCLE over a composition that was still perfectly intact,
   * on a control whose entire promise is that the preview is the printed
   * file. Adding `open` to the deps does not fix it either: the portal is
   * still returning null on the commit where `open` flips. Only the element
   * itself is a reliable signal that there is something to paint on.
   */
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const pickerRef = useRef<HTMLInputElement | null>(null);
  /**
   * WHICH file was decoded, not merely that something was.
   *
   * Storing the pair means a new file — or none — makes `image` null during
   * render, with no effect needed to clear it. Clearing it in the effect is
   * the cascading render the lint rules reject, and it also painted the
   * previous photograph for one frame after the customer chose another.
   */
  const [decoded, setDecoded] = useState<{ file: File; element: HTMLImageElement } | null>(
    null,
  );
  const image = decoded && decoded.file === file ? decoded.element : null;
  const outline = frameShape(shape);
  /**
   * Memoised so the paint effect can depend on the BOX rather than on its two
   * numbers. A fresh object every render would repaint the canvas on every
   * keystroke in the name field, at 512 square, for no change at all.
   */
  const previewBox = useMemo(() => frameSize(outline, PREVIEW_PX), [outline]);
  /**
   * Painting and encoding 2400 square takes a moment, and `busy` is a whole
   * async hop away.
   *
   * The caller only learns there is a file to send once `onUse` hands it one
   * — so for the length of the encode the button was live, silent, and
   * unchanged. On a mid-range phone that is the exact half-second in which
   * people press again, and two presses meant two uploads: two stored assets,
   * two of the visitor's ten per hour, and one orphan the sweep carries for
   * thirty days.
   */
  const [flattening, setFlattening] = useState(false);
  /**
   * A REF as well as the state, because the state is a render behind.
   *
   * Two taps land as two events, and the second handler closes over the
   * render that was current when it was attached — where the latch is still
   * false. Only a ref is true by the time the second one reads it.
   */
  const latch = useRef(false);
  const working = flattening || busy;

  /**
   * Decode the chosen file once, and keep the decoded bitmap.
   *
   * The object URL is revoked when the file changes or this unmounts. Drawing
   * from an already-decoded `Image` after that is fine — the pixels are in
   * memory — and holding the URL open instead leaks one blob per photograph a
   * customer changes their mind about.
   */
  useEffect(() => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    const next = new Image();
    next.onload = () => setDecoded({ file, element: next });
    next.onerror = () => {
      /*
        The file is dropped as well as reported. Leaving it set left the
        button reading “Change photo” over an empty circle — the picture of a
        photograph that loaded — with a toast as the only contradiction, and a
        toast on a phone sits behind the dialog.
      */
      onFileChange(null);
      onProblem("That photo could not be opened. Please try another one.");
    };
    next.src = url;

    return () => URL.revokeObjectURL(url);
    // `onProblem` is a toast call site and changes identity every render;
    // re-decoding the photograph because of that would be absurd.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  /**
   * Repaint whenever anything the customer can move has moved.
   *
   * `paintPhotoFrame` is the same function the export uses, at a different
   * size — so this preview is not a likeness of the printed file, it is the
   * printed file drawn smaller.
   */
  useEffect(() => {
    const context = canvas?.getContext("2d");
    // jsdom has no canvas, and neither does a browser that has run out of
    // contexts. Nothing here is worth throwing over.
    if (!context) return;
    paintPhotoFrame(
      context,
      // `guide` is the one thing the preview has that the file must not:
      // everything outside the outline is white, and so is the page, so
      // without a cut line a round print and a square one look identical
      // and nobody can see which corners they are losing.
      { ...previewBox, shape: outline, guide: true },
      image,
      draft,
    );
  }, [canvas, image, draft, previewBox, outline]);

  const patch = (change: Partial<PhotoPrintDraft>) => onDraftChange({ ...draft, ...change });

  function choose(chosen: File) {
    /**
     * Refused here, before anything is decoded.
     *
     * The server checks the real bytes and always will — but a customer who
     * picked a 40 MB RAW export should be told so at once, not after watching
     * a phone try to open it.
     */
    const problem = photoFileProblem(chosen);
    if (problem) {
      onProblem(problem);
      return;
    }

    /**
     * A NEW photograph starts square on.
     *
     * Zoom, pan and tilt describe the last picture, not this one — carrying
     * them over drops a fresh photo in at somebody else's crop. The NAME is
     * kept, because that is about the order rather than about the file.
     */
    onDraftChange({
      ...draft,
      zoom: emptyPhotoPrintDraft.zoom,
      offsetX: emptyPhotoPrintDraft.offsetX,
      offsetY: emptyPhotoPrintDraft.offsetY,
      rotation: emptyPhotoPrintDraft.rotation,
    });
    onFileChange(chosen);
  }

  async function flatten() {
    if (latch.current || working) return;

    const printBox = frameSize(outline, OUTPUT_PX);
    const sheet = document.createElement("canvas");
    sheet.width = printBox.width;
    sheet.height = printBox.height;
    const context = sheet.getContext("2d");
    if (!context || !image) {
      onProblem("This browser could not prepare the photo. Please try another one.");
      return;
    }

    latch.current = true;
    setFlattening(true);
    try {
      await paint(sheet, context);
    } finally {
      latch.current = false;
      setFlattening(false);
    }
  }

  /** The painting half, split out so the latch above has a clean finally. */
  async function paint(sheet: HTMLCanvasElement, context: FramePainter) {
    if (!image) return;
    paintPhotoFrame(context, { ...frameSize(outline, OUTPUT_PX), shape: outline }, image, draft);

    const encode = (quality: number) =>
      new Promise<Blob | null>((resolve) => {
        sheet.toBlob(resolve, "image/jpeg", quality);
      });

    /**
     * A second, harder squeeze if the first one came out fat.
     *
     * The upload refuses anything over 6 MB, and a 1600px JPEG at this quality
     * is normally well under one — but a very noisy photograph can be several
     * times that, and the customer would be told their photo is too large
     * about a file they never chose and cannot shrink.
     */
    let blob = await encode(0.9);
    if (blob && blob.size > 4 * 1024 * 1024) blob = await encode(0.7);

    if (!blob) {
      onProblem("This browser could not prepare the photo. Please try another one.");
      return;
    }

    onUse(new File([blob], "photo.jpg", { type: "image/jpeg" }));
  }

  const left = charactersLeft(draft.name);

  return (
    /*
      Escape, the backdrop and the ✕ all come through here, and none of them
      cancelled anything: the request was already in flight, so the dialog
      shut and the upload landed anyway — attaching a photo the customer had
      just decided against. There is no cancelling a POST from here, so the
      honest answer is to hold the door until it has answered.
    */
    <Dialog open={open} onOpenChange={(next) => (next || !working) && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Fit your photo in the frame</DialogTitle>
        </DialogHeader>

        <div className="gap-5 sm:grid sm:grid-cols-[minmax(0,1fr)_17rem]">
          {/*
            A CIRCLE, because the printed area is one. The file itself is
            square with white corners — which is what the shop's printer wants
            — and rounding the box is how the customer sees the part that
            survives rather than the part that does not.
          */}
          {/*
            The box takes the PRINT's proportions, so an upright frame is
            upright here too. The outline itself is drawn on the canvas —
            rounding the box instead only worked while every print was round.
          */}
          <div
            className="relative mx-auto mb-5 w-full max-w-sm overflow-hidden rounded-lg border border-border bg-white sm:mb-0"
            style={{ aspectRatio: `${previewBox.width} / ${previewBox.height}` }}
          >
            <canvas
              ref={setCanvas}
              width={previewBox.width}
              height={previewBox.height}
              className="h-full w-full"
              aria-label="Preview of what will be printed"
              role="img"
            />
            {/*
              A large photograph takes a moment to decode, and an unpainted
              circle is indistinguishable from a lost one.
            */}
            {file && !image ? (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                Opening your photo…
              </p>
            ) : null}
          </div>

          <Tabs defaultValue="photo" className="min-w-0">
            <TabsList className="w-full">
              <TabsTrigger value="photo">Photo</TabsTrigger>
              <TabsTrigger value="name">Name</TabsTrigger>
            </TabsList>

            <TabsContent value="photo" className="space-y-4 pt-4">
              <input
                ref={pickerRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const chosen = event.target.files?.[0];
                  // Cleared either way, so re-choosing the same file after a
                  // refusal still fires a change.
                  event.target.value = "";
                  if (chosen) choose(chosen);
                }}
              />
              {!file && attachedUrl ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-cream-100 p-2 text-xs text-muted-foreground">
                  <span className="relative size-8 shrink-0 overflow-hidden rounded-full border border-border">
                    <OptimizedImage
                      src={attachedUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="32px"
                    />
                  </span>
                  <span>A photo is already attached. Choosing another replaces it.</span>
                </div>
              ) : null}
              <Button
                type="button"
                className="w-full"
                onClick={() => pickerRef.current?.click()}
              >
                <ImageUp className="size-4" />
                {file ? "Change photo" : "Upload photo"}
              </Button>
              <p className="text-xs text-muted-foreground">
                JPEG, PNG or WebP, up to {MAX_CHOSEN_BYTES / (1024 * 1024)} MB.
              </p>

              <Adjust
                label="Zoom"
                value={draft.zoom}
                onChange={(zoom) => patch({ zoom })}
                {...PHOTO_RANGES.zoom}
              />
              <Adjust
                label="Up / down"
                value={draft.offsetY}
                onChange={(offsetY) => patch({ offsetY })}
                {...PHOTO_RANGES.offset}
              />
              <Adjust
                label="Left / right"
                value={draft.offsetX}
                onChange={(offsetX) => patch({ offsetX })}
                {...PHOTO_RANGES.offset}
              />
              <Adjust
                label="Rotate"
                value={draft.rotation}
                onChange={(rotation) => patch({ rotation })}
                {...PHOTO_RANGES.rotation}
              />
            </TabsContent>

            <TabsContent value="name" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="print-name">Write a name to print on it</Label>
                <Input
                  id="print-name"
                  value={draft.name}
                  maxLength={NAME_LIMIT}
                  placeholder="Leave empty for no name"
                  onChange={(event) => patch({ name: event.target.value })}
                />
                {/*
                  No "Set" button, deliberately. The reference has one, and a
                  customer who types a name, does not press it, and presses
                  Continue gets a frame with no name on it and no idea why.
                  What they type is what they see.
                */}
                <p className="text-xs text-muted-foreground">
                  {left} character{left === 1 ? "" : "s"} left
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.bold}
                    onCheckedChange={(checked) => patch({ bold: checked === true })}
                  />
                  <span className="font-semibold">Bold</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.italic}
                    onCheckedChange={(checked) => patch({ italic: checked === true })}
                  />
                  <span className="italic">Italic</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="color"
                    aria-label="Colour"
                    value={draft.colour}
                    onChange={(event) => patch({ colour: event.target.value })}
                    className="size-7 cursor-pointer rounded border border-border bg-transparent p-0.5"
                  />
                  <span>Colour</span>
                </label>
              </div>

              <Adjust
                label="Text size"
                value={draft.nameSize}
                onChange={(nameSize) => patch({ nameSize })}
                {...PHOTO_RANGES.nameSize}
              />
              <Adjust
                label="Up / down"
                value={draft.nameY}
                onChange={(nameY) => patch({ nameY })}
                {...PHOTO_RANGES.offset}
              />
              <Adjust
                label="Left / right"
                value={draft.nameX}
                onChange={(nameX) => patch({ nameX })}
                {...PHOTO_RANGES.offset}
              />
              <Adjust
                label="Rotate"
                value={draft.nameRotation}
                onChange={(nameRotation) => patch({ nameRotation })}
                {...PHOTO_RANGES.rotation}
              />
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="items-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDraftChange({ ...emptyPhotoPrintDraft, name: draft.name })}
            className="mr-auto text-muted-foreground"
          >
            <RotateCcw className="size-4" />
            Start again
          </Button>
          <Button type="button" variant="outline" disabled={working} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {/*
            Disabled until there is a photograph, because there is nothing to
            flatten without one — and a name alone is not a thing this control
            promises to print.
          */}
          <Button type="button" onClick={() => void flatten()} disabled={!image || working}>
            {working ? "Sending…" : "Use this photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One labelled slider, with the number it is currently on. */
function Adjust({
  label,
  value,
  onChange,
  min,
  max,
  step,
  largeStep,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  largeStep: number;
}) {
  return (
    <div className={cn("flex items-center gap-3")}>
      <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
      <Slider
        aria-label={label}
        value={value}
        onValueChange={onChange}
        min={min}
        max={max}
        step={step}
        largeStep={largeStep}
      />
    </div>
  );
}
