"use client";

import NextImage, { getImageProps, type ImageProps } from "next/image";
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
/** Trimmed and repaired, the way every image here is — see the notes above. */
function resolveSrc(src: string | null | undefined): string {
  const trimmed = typeof src === "string" ? src.trim() : "";
  if (!trimmed) return "";
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return trimmed;
  return fixBrokenImageUrl(trimmed);
}

export function OptimizedImage({
  src,
  alt,
  className,
  fill,
  onError,
  referrerPolicy,
  ...rest
}: OptimizedImageProps) {
  const resolved = useMemo(() => resolveSrc(src), [src]);

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

/**
 * ONE PICTURE ON THE WIRE, CHOSEN BY THE WINDOW: a wide picture from
 * `breakpoint` up and a narrow one below it, filling a positioned box.
 *
 * Two `fill` images toggled with `hidden` / `lg:block` look the same and cost
 * twice: `display: none` does not stop a browser fetching an <img>. Measured on
 * the banner strip at 1440px, the hidden phone copy of every banner was
 * downloaded and drawn nowhere, and next/image warned that a 100vw image was
 * "not rendered at full viewport width" — because it was rendered at zero.
 *
 * A <picture> with a <source media> lets the browser fetch only the one it
 * shows. Both srcsets come from `getImageProps`, so each is optimised exactly
 * as an OptimizedImage would be (Next's documented art-direction pattern), and
 * each takes its own `sizes`. A host outside the allow-list is served
 * `unoptimized`, as above. With no narrow picture the wide one is used at both
 * sizes.
 */
export function ArtDirectedImage({
  wide,
  narrow,
  breakpoint,
  wideSizes,
  narrowSizes,
  alt,
  className,
  loading = "lazy",
}: {
  wide?: string | null;
  narrow?: string | null;
  /** Width in px from which `wide` is shown. */
  breakpoint: number;
  wideSizes: string;
  narrowSizes: string;
  alt: string;
  /** Applied to the one <img>, so it can change at the breakpoint (e.g. contain → cover). */
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const wideSrc = useMemo(() => resolveSrc(wide), [wide]);
  const narrowSrc = useMemo(() => resolveSrc(narrow) || wideSrc, [narrow, wideSrc]);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const wideVerdict = classifyImageSrc(wideSrc);
  const narrowVerdict = classifyImageSrc(narrowSrc);
  if (wideVerdict === "placeholder" || narrowVerdict === "placeholder" || failedSrc === narrowSrc) {
    return <ImagePlaceholder alt={alt} className={className} fill />;
  }

  const desktop = getImageProps({
    src: wideSrc,
    alt,
    fill: true,
    sizes: wideSizes,
    unoptimized: wideVerdict === "as-is",
  }).props;
  const { srcSet: phoneSrcSet, ...phone } = getImageProps({
    src: narrowSrc,
    alt,
    fill: true,
    sizes: narrowSizes,
    loading,
    unoptimized: narrowVerdict === "as-is",
  }).props;

  return (
    <picture>
      <source
        media={`(min-width: ${breakpoint}px)`}
        srcSet={desktop.srcSet ?? desktop.src}
        sizes={desktop.srcSet ? wideSizes : undefined}
      />
      <img
        {...phone}
        srcSet={phoneSrcSet}
        alt={alt}
        className={className}
        referrerPolicy={narrowVerdict === "as-is" || wideVerdict === "as-is" ? "no-referrer" : undefined}
        onError={() => setFailedSrc(narrowSrc)}
      />
    </picture>
  );
}
