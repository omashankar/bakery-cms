"use client";

import { OptimizedImage } from "@/components/shared/optimized-image";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { fixBrokenImageUrl } from "@/constants/demo-images";
import { cn } from "@/lib/utils";
import { useBusinessLabels } from "@/hooks/use-business-labels";

interface ProductGalleryProps {
  images: string[];
  productName: string;
  /**
   * Featured / Bestseller / Trending, on the photo rather than beside the
   * name.
   *
   * It is a claim about the PRODUCT, and it reads as one where the product
   * is. In the text column it sat in a row with the category and the eggless
   * mark, three chips deep, and was the least visible of the three.
   */
  badge?: string;
}

/**
 * How much bigger the hover panel shows the photo.
 *
 * 2.5 rather than 3 or 4: a shop's photos are its own, mostly around a thousand
 * pixels wide, and past about two and a half times the browser is enlarging
 * pixels rather than revealing detail — which reads as a blurry mistake instead
 * of a closer look.
 */
const HOVER_ZOOM = 2.5;

/**
 * Every photo of one product, with the rest of them beside it.
 *
 * The thumbnail rail was written the day this component was, and no customer
 * had ever seen it: it renders on `images.length > 1`, and the helper feeding
 * it returned `[cake.image]` — one element, always — because the admin form had
 * a single photo box. All three were fixed together; a rail with nothing to put
 * in it is not worth laying out.
 *
 * On a wide screen the rail is a VERTICAL strip to the left of the photo, which
 * is what the reference storefronts do and what keeps the main image as large
 * as the column allows. Below `lg` it stays a row underneath, because a strip
 * beside the photo on a phone leaves neither of them big enough to read.
 */
export function ProductGallery({ images, productName, badge }: ProductGalleryProps) {
  const labels = useBusinessLabels();
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  /**
   * Where the pointer is over the photo, as a fraction of it, or null.
   *
   * Null means no magnifier: the pointer has left, or it was never a mouse in
   * the first place. Fractions rather than pixels, so the same two numbers
   * drive both the lens and the panel's background position whatever size
   * either happens to be drawn at.
   */
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null);
  const activeImage = images[activeIndex] ?? images[0];

  const step = (delta: number) => {
    setActiveIndex((current) => (current + delta + images.length) % images.length);
  };

  /**
   * Arrow keys move through the photos while the lightbox is open.
   *
   * Bound to the window rather than the dialog, because the dialog moves focus
   * to its close button and a key pressed before anything else is clicked would
   * otherwise go nowhere. Bound only while it is open, so the arrows do nothing
   * to the page behind it.
   */
  useEffect(() => {
    if (!zoomOpen || images.length < 2) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => (current - 1 + images.length) % images.length);
      }
      if (event.key === "ArrowRight") {
        setActiveIndex((current) => (current + 1) % images.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomOpen, images.length]);

  /**
   * A frame, even with nothing in it.
   *
   * This returned `null`, which is not a missing photo but a missing COLUMN:
   * the product page puts the gallery in the left cell of a two-column grid,
   * so a product with no image left that cell empty and the text stranded
   * beside it. A product with no photo is reachable — a new one is born with an
   * empty image list — and `OptimizedImage` already draws a placeholder for an
   * empty src.
   */
  if (!activeImage) {
    return (
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-cream-100">
        <OptimizedImage src="" alt={productName} fill className="object-cover" />
      </div>
    );
  }

  /** The same repair `OptimizedImage` applies, for the CSS background below. */
  const magnifiedSrc = fixBrokenImageUrl(activeImage);
  /** The lens is the slice the panel is showing, so it is 1/zoom of the photo. */
  const lensSize = 100 / HOVER_ZOOM;
  const lensEdge = (value: number) =>
    Math.min(100 - lensSize, Math.max(0, value * 100 - lensSize / 2));

  function trackPointer(event: React.PointerEvent<HTMLElement>) {
    /*
      MOUSE ONLY. A finger has no hover: on a touchscreen every tap would flash
      a magnifier over the very thing being tapped and then leave it there, and
      the panel would cover the buy box the tap was heading for.
    */
    if (event.pointerType !== "mouse") return;

    const rect = event.currentTarget.getBoundingClientRect();
    setLens({
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    });
  }

  return (
    <>
      {/*
        `flex-row-reverse` on desktop, so the MAIN IMAGE stays first in the
        document while the rail is drawn to its left. Reversing the markup
        instead would hand a screen reader, and the browser's image priority,
        four thumbnails before the photo the page is about.
      */}
      <div className="relative flex flex-col gap-4 lg:flex-row-reverse lg:items-start lg:gap-4">
        <button
          type="button"
          onClick={() => setZoomOpen(true)}
          onPointerMove={trackPointer}
          onPointerLeave={() => setLens(null)}
          className="group relative block aspect-square w-full overflow-hidden rounded-2xl border border-border bg-cream-100 lg:min-w-0 lg:flex-1"
          aria-label={`Zoom ${labels.productWord.toLowerCase()} image`}
        >
          {badge ? (
            <span className="absolute top-0 left-0 z-10 rounded-br-lg bg-bakery-700 px-3 py-1 text-xs font-semibold text-white">
              {badge}
            </span>
          ) : null}
          <OptimizedImage
            src={activeImage}
            alt={productName}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="object-cover"
          />
          {/*
            The lens — the part of the photo the panel beside it is showing.

            Without it the panel is a picture that moves for no visible reason.
            `hidden lg:block`, because the panel it belongs to only exists there.
          */}
          {lens ? (
            <span
              aria-hidden
              data-testid="zoom-lens"
              className="pointer-events-none absolute hidden border-2 border-bakery-700/70 bg-white/20 lg:block"
              style={{
                width: `${lensSize}%`,
                height: `${lensSize}%`,
                left: `${lensEdge(lens.x)}%`,
                top: `${lensEdge(lens.y)}%`,
              }}
            />
          ) : (
            /*
              The magnifying-glass hint hides while the magnifier is running. It
              is an invitation, and it stops being one the moment it has been
              accepted.
            */
            <div className="absolute right-4 bottom-4 rounded-lg border border-border bg-white/95 p-2 text-bakery-700">
              <ZoomIn className="size-4" />
            </div>
          )}
        </button>

        {images.length > 1 ? (
          <div
            className={cn(
              "grid grid-cols-4 gap-2 sm:gap-3",
              // The strip: four visible at 5rem each, and it scrolls rather
              // than growing past the photo it sits beside.
              "lg:flex lg:max-h-[26rem] lg:w-20 lg:shrink-0 lg:flex-col lg:gap-3 lg:overflow-y-auto",
            )}
          >
            {images.map((src, index) => (
              <button
                key={`${src}-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                /*
                  Hover moves the rail too, not only a click.

                  It is what a hand already does on the way past, and it is
                  the difference between a rail that answers and one that
                  has to be operated. The click stays and does the same
                  thing: a keyboard reaches these with Enter, and a tap on a
                  phone is a click — where there is no hover to have.
                */
                onPointerEnter={() => setActiveIndex(index)}
                aria-label={`Show image ${index + 1} of ${images.length}`}
                aria-current={activeIndex === index}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-xl border bg-cream-100 transition-premium lg:w-full lg:shrink-0",
                  activeIndex === index
                    ? "border-bakery-700 ring-2 ring-bakery-200"
                    : "border-border hover:border-bakery-300"
                )}
              >
                <OptimizedImage
                  src={src}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 25vw, 96px"
                />
              </button>
            ))}
          </div>
        ) : null}

        {/*
          THE PANEL, beside the photo and over the column next to it.

          A drawn element rather than a second image: `background-size` past
          100% with a percentage `background-position` is the one way to show a
          slice of a picture at its own resolution without fetching another copy
          of it. The browser already has this file.

          `pointer-events-none` is the important part — the panel sits over the
          buy box, and somebody moving towards Add to Cart must not have their
          click land on a magnifier that is about to disappear.
        */}
        {lens ? (
          <div
            aria-hidden
            data-testid="zoom-panel"
            className="pointer-events-none absolute top-0 left-full z-30 ml-4 hidden aspect-square w-[26rem] rounded-2xl border border-border bg-white bg-no-repeat shadow-lg lg:block"
            style={{
              backgroundImage: `url("${magnifiedSrc}")`,
              backgroundSize: `${HOVER_ZOOM * 100}%`,
              backgroundPosition: `${lens.x * 100}% ${lens.y * 100}%`,
            }}
          />
        ) : null}
      </div>

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="border-border p-2 sm:max-w-4xl sm:p-3" showCloseButton>
          <DialogTitle className="sr-only">{productName}</DialogTitle>
          <div className="relative aspect-square overflow-hidden rounded-xl bg-cream-100">
            <OptimizedImage
              src={activeImage}
              alt={productName}
              fill
              className="object-contain"
              sizes="90vw"
            />

            {/*
              The arrows sit ON the picture, at its edges, where the reference
              puts them and where a hand already is. They were a Previous and a
              Next button in a row underneath — further to travel, and reading
              as a form rather than a viewer.
            */}
            {images.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Previous image"
                  className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full border border-border bg-white/90 p-2 text-bakery-700 transition-premium hover:bg-white"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Next image"
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full border border-border bg-white/90 p-2 text-bakery-700 transition-premium hover:bg-white"
                >
                  <ChevronRight className="size-5" />
                </button>
              </>
            ) : null}
          </div>

          {/*
            The strip, so somebody can go straight to the photo they want rather
            than stepping through the ones they do not. The zoom showed
            `activeImage` and nothing else: with one photo that was complete,
            with several it was a dead end.
          */}
          {images.length > 1 ? (
            <div className="flex flex-wrap justify-center gap-2 pb-1">
              {images.map((src, index) => (
                <button
                  key={`zoom-${src}-${index}`}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Show image ${index + 1} of ${images.length} in the viewer`}
                  aria-current={activeIndex === index}
                  className={cn(
                    "relative size-14 overflow-hidden rounded-lg border bg-cream-100 transition-premium",
                    activeIndex === index
                      ? "border-bakery-700 ring-2 ring-bakery-200"
                      : "border-border hover:border-bakery-300"
                  )}
                >
                  <OptimizedImage src={src} alt="" fill className="object-cover" sizes="56px" />
                </button>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
