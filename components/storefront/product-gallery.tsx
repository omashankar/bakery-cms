"use client";

import { OptimizedImage } from "@/components/shared/optimized-image";
import { useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBusinessLabels } from "@/hooks/use-business-labels";

interface ProductGalleryProps {
  images: string[];
  productName: string;
}

/**
 * Every photo of one product, with the rest of them beside it.
 *
 * The thumbnail rail was written the day this component was, and no customer
 * had ever seen it: it renders on `images.length > 1`, and the helper feeding
 * it returned `[cake.image]` — one element, always — because the admin form had
 * a single photo box. All three are fixed together; a rail with nothing to put
 * in it is not worth laying out.
 *
 * On a wide screen the rail is a VERTICAL strip to the left of the photo, which
 * is what the reference storefronts do and what keeps the main image as large
 * as the column allows. Below `lg` it stays a row underneath, because a strip
 * beside the photo on a phone leaves neither of them big enough to read.
 */
export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const labels = useBusinessLabels();
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const activeImage = images[activeIndex] ?? images[0];

  /**
   * A frame, even with nothing in it.
   *
   * This returned `null`, which is not a missing photo but a missing COLUMN:
   * the product page puts the gallery in the left cell of a two-column grid,
   * so a product with no image left that cell empty and the text stranded
   * beside it. A product with no photo is reachable — a new one is born with
   * `images: []` — and `OptimizedImage` already draws a placeholder for an
   * empty src.
   */
  if (!activeImage) {
    return (
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-cream-100">
        <OptimizedImage src="" alt={productName} fill className="object-cover" />
      </div>
    );
  }

  const step = (delta: number) => {
    setActiveIndex((current) => {
      const next = (current + delta + images.length) % images.length;
      return next;
    });
  };

  return (
    <>
      {/*
        `flex-row-reverse` on desktop, so the MAIN IMAGE stays first in the
        document while the rail is drawn to its left. Reversing the markup
        instead would hand a screen reader, and the browser's image priority,
        four thumbnails before the photo the page is about.
      */}
      <div className="flex flex-col gap-4 lg:flex-row-reverse lg:items-start lg:gap-4">
        <button
          type="button"
          onClick={() => setZoomOpen(true)}
          className="group relative block aspect-square w-full overflow-hidden rounded-2xl border border-border bg-cream-100 lg:min-w-0 lg:flex-1"
          aria-label={`Zoom ${labels.productWord.toLowerCase()} image`}
        >
          <OptimizedImage
            src={activeImage}
            alt={productName}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="object-cover transition-transform group-hover:scale-[1.02]"
          />
          <div className="absolute right-4 bottom-4 rounded-lg border border-border bg-white/95 p-2 text-bakery-700">
            <ZoomIn className="size-4" />
          </div>
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
      </div>

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="border-border p-2 sm:max-w-3xl sm:p-3" showCloseButton>
          <DialogTitle className="sr-only">{productName}</DialogTitle>
          <div className="relative aspect-square overflow-hidden rounded-xl bg-cream-100">
            <OptimizedImage src={activeImage} alt={productName} fill className="object-contain" sizes="90vw" />
          </div>
          {/*
            The zoom showed `activeImage` and nothing else. With one photo that
            was complete; with several it is a dead end — the customer opens the
            picture they wanted a closer look at and has to close it to see the
            next one.
          */}
          {images.length > 1 ? (
            <div className="flex items-center justify-between gap-3 px-1 pb-1">
              <Button type="button" variant="outline" size="sm" onClick={() => step(-1)}>
                <ChevronLeft className="size-4" />
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                {activeIndex + 1} of {images.length}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => step(1)}>
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
