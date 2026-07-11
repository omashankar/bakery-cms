"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageIcon } from "lucide-react";
import { fixBrokenImageUrl } from "@/constants/demo-images";
import { cn } from "@/lib/utils";

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
}

/** Native img with dead-Unsplash repair — avoids Next image optimizer 404 flash */
export function SafeImage({ src, alt, className, fill = true }: SafeImageProps) {
  const resolvedSrc = useMemo(() => {
    const trimmed = src.trim();
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
