"use client";

import { useEffect, useMemo, useState } from "react";
import { fixBrokenImageUrl } from "@/constants/demo-images";
import { thumbnailImageUrl } from "@/lib/image-url";
import { cn } from "@/lib/utils";
import { ImagePlaceholder } from "./image-placeholder";

interface SafeImageProps {
  /**
   * Optional, because the data this renders often has no image.
   *
   * It was `src: string`, and the type was simply wrong about what reaches it:
   * an order's stored items carry no `image` at all — the server re-prices what
   * the customer chose and older lines predate the field — so `src.trim()`
   * threw, and the admin order detail page rendered "This page couldn't load"
   * instead of the order. A whole screen lost to a missing thumbnail.
   *
   * The component already knew what to do with nothing: everything below
   * `if (!resolvedSrc)` is the placeholder. It just never got there.
   */
  src?: string | null;
  alt: string;
  className?: string;
  fill?: boolean;
  /**
   * The width it is drawn at, in CSS pixels — when given, the image is asked
   * for at that size (doubled for retina) instead of as the stored original.
   * The admin's 40px list thumbnails were downloading 500–1200px originals:
   * ~80 KB each, and a whole product list of them on a phone.
   */
  width?: number;
  /**
   * Fetch at once instead of lazily. Only for an image in the first screenful
   * that may be its largest thing — a lazy LCP image waits for layout first.
   */
  eager?: boolean;
}

/** Native img with dead-Unsplash repair — avoids Next image optimizer 404 flash */
export function SafeImage({ src, alt, className, fill = true, width, eager = false }: SafeImageProps) {
  const resolvedSrc = useMemo(() => {
    // Not `src ?? ""`: a number or an object from untyped JSON has no `.trim`
    // either, and this component is downstream of Mixed-typed Mongo documents.
    const trimmed = typeof src === "string" ? src.trim() : "";
    if (!trimmed) return "";
    if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return trimmed;
    const fixed = fixBrokenImageUrl(trimmed);
    return width ? thumbnailImageUrl(fixed, width) : fixed;
  }, [src, width]);

  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolvedSrc]);

  if (!resolvedSrc || resolvedSrc.startsWith("blob:") || failed) {
    return <ImagePlaceholder alt={alt} className={className} fill={fill} />;
  }

  return (
    <img
      key={resolvedSrc}
      src={resolvedSrc}
      alt={alt}
      className={cn(fill ? "absolute inset-0 size-full object-cover" : "", className)}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
