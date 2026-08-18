"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageIcon } from "lucide-react";
import { fixBrokenImageUrl } from "@/constants/demo-images";
import { cn } from "@/lib/utils";

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
}

/** Native img with dead-Unsplash repair — avoids Next image optimizer 404 flash */
export function SafeImage({ src, alt, className, fill = true }: SafeImageProps) {
  const resolvedSrc = useMemo(() => {
    // Not `src ?? ""`: a number or an object from untyped JSON has no `.trim`
    // either, and this component is downstream of Mixed-typed Mongo documents.
    const trimmed = typeof src === "string" ? src.trim() : "";
    if (!trimmed) return "";
    if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return trimmed;
    return fixBrokenImageUrl(trimmed);
  }, [src]);

  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolvedSrc]);

  if (!resolvedSrc || resolvedSrc.startsWith("blob:") || failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          fill ? "absolute inset-0" : className
        )}
        title={alt}
      >
        <ImageIcon className="size-4 opacity-60" />
      </div>
    );
  }

  return (
    <img
      key={resolvedSrc}
      src={resolvedSrc}
      alt={alt}
      className={cn(fill ? "absolute inset-0 size-full object-cover" : "", className)}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
