"use client";

import { SafeImage } from "@/components/shared/safe-image";
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

export function MediaThumbnail({
  src,
  alt,
  className,
  fill = true,
}: MediaThumbnailProps) {
  return <SafeImage src={src} alt={alt} fill={fill} className={cn(className)} />;
}
