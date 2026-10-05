"use client";

import { useId } from "react";

import { frameShape, framePathData } from "@/lib/images/photo-print-layout";
import type { PhotoFrameShapeId } from "@/types/product";
import { cn } from "@/lib/utils";

interface FrameThumbnailProps {
  /** The finished photograph, as the shop received it. */
  src: string;
  /** The outline this product prints in. Absent means round, as it always has. */
  shape?: PhotoFrameShapeId;
  /** The box's long side, in CSS pixels. */
  size?: number;
  className?: string;
}

/**
 * The photograph a customer fitted, shown back in the shape it will be printed.
 *
 * Every screen that showed it back drew it in a `rounded-full` box with
 * `object-cover`. That is right for exactly one of the six frames. On a heart
 * it cuts the lobes off; on a mug wrap — 7:3 — a square box with `cover` keeps
 * three sevenths of the picture and throws the rest away. The customer had just
 * spent a minute deciding which corners were expendable, and the screen that
 * confirms it made a different decision for them.
 *
 * Clipped rather than relying on the file's own white corners. The exported
 * JPEG IS the frame's box with everything outside the shape painted white, so
 * on a white card it already looks right — and stops looking right the moment
 * it is put on the cream card this shop actually uses, or in dark mode, where
 * a heart arrives inside a bright white square.
 *
 * `objectBoundingBox` units mean the path is in fractions and the browser
 * scales it, so this works at any size without a second definition. A separate
 * `<clipPath>` per instance because ids have to be unique on the page; `useId`
 * makes that safe under hydration.
 */
export function FrameThumbnail({ src, shape, size = 36, className }: FrameThumbnailProps) {
  const outline = frameShape(shape);
  const clipId = useId().replace(/:/g, "");
  const path = framePathData(outline);

  /* The box takes the frame's proportions, so nothing is cropped to fit it. */
  const width = outline.ratio >= 1 ? size : Math.round(size * outline.ratio);
  const height = outline.ratio >= 1 ? Math.round(size / outline.ratio) : size;

  return (
    <span
      className={cn("relative block shrink-0 overflow-hidden", className)}
      style={{ width, height }}
    >
      <svg aria-hidden className="pointer-events-none absolute size-0">
        <clipPath id={clipId} clipPathUnits="objectBoundingBox">
          <path d={path} />
        </clipPath>
      </svg>
      {/*
        A plain <img>, not the optimised one. This is a Cloudinary URL the
        customer uploaded seconds ago at a size measured in dozens of pixels —
        the loader's work costs more than it saves, and `fill` would need a
        positioned parent that the clip then has to be applied around.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        className="size-full object-cover"
        style={{ clipPath: `url(#${clipId})` }}
      />
    </span>
  );
}
