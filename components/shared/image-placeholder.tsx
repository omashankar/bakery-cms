import { ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface ImagePlaceholderProps {
  /** Used as the tooltip — there is no image to describe, but there is a caption. */
  alt: string;
  className?: string;
  fill?: boolean;
}

/**
 * What is drawn where an image should be but isn't.
 *
 * Extracted from safe-image.tsx so components/shared/optimized-image.tsx can
 * show the SAME tile. Copying it would have let the admin form preview and the
 * storefront drift apart — and an asymmetry exactly like that is what hid the
 * foreign-host crash: every admin image field renders through a raw `<img>`,
 * so a pasted Pinterest link looked perfect right up until the storefront
 * tried to optimise it.
 */
export function ImagePlaceholder({ alt, className, fill = true }: ImagePlaceholderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-muted text-muted-foreground",
        fill ? "absolute inset-0" : className,
      )}
      title={alt}
    >
      <ImageIcon className="size-4 opacity-60" />
    </div>
  );
}
