/**
 * The decisions in shrink-image.ts, tested without a canvas.
 *
 * jsdom implements neither `createImageBitmap` nor `canvas.toBlob`, so the
 * re-encode itself cannot run here — which is exactly why the two judgements
 * that decide whether it SHOULD run were pulled out as pure functions. Those
 * are where the damage would be: rasterising a shop's SVG logo, or flattening
 * an animated GIF to its first frame, are silent losses no size check catches.
 */
import { describe, expect, it } from "vitest";

import { ALREADY_SMALL_BYTES, MAX_EDGE, fittedSize, shouldShrink } from "./shrink-image";

const MB = 1024 * 1024;

describe("what gets re-encoded", () => {
  it("shrinks a phone photograph", () => {
    expect(shouldShrink("image/jpeg", 6 * MB)).toBe(true);
    expect(shouldShrink("image/png", 3 * MB)).toBe(true);
    expect(shouldShrink("image/webp", 2 * MB)).toBe(true);
  });

  it("leaves an SVG alone, because rasterising a logo destroys it", () => {
    expect(shouldShrink("image/svg+xml", 6 * MB)).toBe(false);
  });

  it("leaves a GIF alone, because a canvas keeps only the first frame", () => {
    expect(shouldShrink("image/gif", 6 * MB)).toBe(false);
  });

  it("does not bother with a file that is already small", () => {
    expect(shouldShrink("image/jpeg", ALREADY_SMALL_BYTES)).toBe(false);
    expect(shouldShrink("image/jpeg", ALREADY_SMALL_BYTES + 1)).toBe(true);
  });

  it("ignores anything that is not an image", () => {
    expect(shouldShrink("application/pdf", 6 * MB)).toBe(false);
    expect(shouldShrink("", 6 * MB)).toBe(false);
  });
});

describe("the size a photo becomes", () => {
  it("scales the long edge down and keeps the shape", () => {
    expect(fittedSize(4000, 3000)).toEqual({ width: MAX_EDGE, height: 1200 });
    expect(fittedSize(3000, 4000)).toEqual({ width: 1200, height: MAX_EDGE });
  });

  it("never upscales a small picture", () => {
    // Enlarging a 400px logo to 1600 would add bytes and no detail.
    expect(fittedSize(400, 300)).toEqual({ width: 400, height: 300 });
    expect(fittedSize(MAX_EDGE, MAX_EDGE)).toEqual({ width: MAX_EDGE, height: MAX_EDGE });
  });

  it("keeps a square square, and a panorama a panorama", () => {
    expect(fittedSize(4000, 4000)).toEqual({ width: MAX_EDGE, height: MAX_EDGE });

    const wide = fittedSize(8000, 1000);
    expect(wide.width).toBe(MAX_EDGE);
    expect(wide.width / wide.height).toBeCloseTo(8, 1);
  });

  it("does not round a dimension away to zero", () => {
    // A 10000×3 strip is absurd, but a height of 0 would make the canvas throw.
    expect(fittedSize(10000, 3).height).toBeGreaterThan(0);
  });
});
