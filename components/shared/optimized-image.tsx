"use client";

import NextImage, { type ImageProps } from "next/image";
import { useMemo, useState } from "react";

import { fixBrokenImageUrl } from "@/constants/demo-images";
import { classifyImageSrc } from "@/lib/images/image-hosts";
import { ImagePlaceholder } from "./image-placeholder";

export type OptimizedImageProps = Omit<ImageProps, "src"> & {
  /**
   * Optional, and often absent: this renders CMS content out of Mongo, where a
   * category can have no picture and an older document can have no field.
   */
  src?: string | null;
};

/**
 * The only component in this repo allowed to import `next/image`.
 *
 * A raw `<Image>` THROWS during render for a src whose hostname is not in
 * `images.remotePatterns` — E231, from image-loader.js — and every image on
 * this site is a URL an admin typed. One Pinterest link pasted into the
 * homepage builder took down the builder preview AND the live storefront,
 * because features/cms-sections/* is mounted by both.
 *
 * Widening the allow-list would only move the next hostname's turn. Instead
 * this asks lib/images/image-hosts.ts — the same list next.config.ts is built
 * from — and passes `unoptimized` for anything outside it. That is not a
 * fallback so much as a structural guarantee: `unoptimized` returns early from
 * generateImgAttrs (get-img-props.js:95-123) WITHOUT calling the loader, so
 * E231, E360 (protocol-relative), E63 (unparseable) and E871 (local src with a
 * query) all become unreachable. Allowed hosts keep full optimisation; foreign
 * ones render at their own size rather than not at all.
 *
 * Two details that are load-bearing rather than tidy:
 *  - The trim is not cosmetic. Leading or trailing whitespace throws E176/E21
 *    from get-img-props.js:369-379, which runs BEFORE generateImgAttrs — so
 *    `unoptimized` does not save you from it and only trimming does.
 *  - `onError` is attached on BOTH branches. On the optimised branch it also
 *    catches a genuine optimiser 400 (a Cloudinary asset since deleted), which
 *    turns the last remaining blank rectangles into the placeholder tile.
 *
 * Every call site in this repo uses `fill`; the props are otherwise passed
 * through untouched, so `sizes`, `priority` and `className` behave exactly as
 * they did with `next/image`.
 */
export function OptimizedImage({
  src,
  alt,
  className,
  fill,
  onError,
  referrerPolicy,
  ...rest
}: OptimizedImageProps) {
  const resolved = useMemo(() => {
    const trimmed = typeof src === "string" ? src.trim() : "";
    if (!trimmed) return "";
    if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return trimmed;
    return fixBrokenImageUrl(trimmed);
  }, [src]);

  /**
   * WHICH src failed, not merely that one did.
   *
   * Storing the value means a new `src` clears the failure during render, with
   * no effect to reset it — the reset-in-an-effect this replaces is a cascading
   * render the lint rules reject, and it briefly showed the broken image again
   * before the effect ran.
   */
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const verdict = classifyImageSrc(resolved);

  if (verdict === "placeholder" || failedSrc === resolved) {
    return <ImagePlaceholder alt={alt} className={className} fill={fill} />;
  }

  const asIs = verdict === "as-is";

  return (
    <NextImage
      {...rest}
      src={resolved}
      alt={alt}
      fill={fill}
      className={className}
      unoptimized={asIs}
      // Matches components/shared/safe-image.tsx: a foreign host is often one
      // with hotlink protection keyed on the referrer, and this is the request
      // we do not control.
      referrerPolicy={asIs ? "no-referrer" : referrerPolicy}
      onError={(event) => {
        setFailedSrc(resolved);
        onError?.(event);
      }}
    />
  );
}
