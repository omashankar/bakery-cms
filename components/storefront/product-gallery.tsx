"use client";

import Image from "next/image";
import { useState } from "react";
import { ZoomIn } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ProductGalleryProps {
  images: string[];
  productName: string;
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const activeImage = images[activeIndex] ?? images[0];

  if (!activeImage) return null;

  return (
    <>
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setZoomOpen(true)}
          className="group relative block aspect-square w-full overflow-hidden rounded-2xl border border-border bg-cream-100"
          aria-label="Zoom product image"
        >
          <Image
            src={activeImage}
            alt={productName}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover transition-transform group-hover:scale-[1.02]"
          />
          <div className="absolute right-4 bottom-4 rounded-lg border border-border bg-white/95 p-2 text-bakery-700">
            <ZoomIn className="size-4" />
          </div>
        </button>

        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {images.map((src, index) => (
            <button
              key={`${src}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-xl border bg-cream-100 transition-premium",
                activeIndex === index
                  ? "border-bakery-700 ring-2 ring-bakery-200"
                  : "border-border hover:border-bakery-300"
              )}
            >
              <Image src={src} alt="" fill className="object-cover" sizes="100px" />
            </button>
          ))}
        </div>
      </div>

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-3xl border-border p-2 sm:p-3" showCloseButton>
          <DialogTitle className="sr-only">{productName}</DialogTitle>
          <div className="relative aspect-square overflow-hidden rounded-xl bg-cream-100">
            <Image src={activeImage} alt={productName} fill className="object-contain" sizes="90vw" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
