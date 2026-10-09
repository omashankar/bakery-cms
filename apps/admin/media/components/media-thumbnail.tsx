"use client";

import { SafeImage } from "@/components/shared/safe-image";
import { thumbnailImageUrl } from "@/lib/image-url";
import { cn } from "@/lib/utils";

interface MediaThumbnailProps {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  fill?: boolean;
  width?: number;
  height?: number;
}

/** "200px" → 200. Callers already state the rendered size as `sizes`. */
function pixels(sizes: string | undefined, width: number | undefined): number {
  if (width) return width;
  const match = /(\d+)px\s*$/.exec(sizes ?? "");
  return match ? Number(match[1]) : 400;
}

export function MediaThumbnail({
  src,
  alt,
  className,
  sizes,
  width,
  fill = true,
}: MediaThumbnailProps) {
  // A preview sized to its box, not the stored original — see thumbnailImageUrl.
  return (
    <SafeImage
      src={thumbnailImageUrl(src, pixels(sizes, width))}
      alt={alt}
      fill={fill}
      className={cn(className)}
    />
  );
}
