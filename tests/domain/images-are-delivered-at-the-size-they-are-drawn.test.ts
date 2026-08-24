import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { optimizedImageUrl } from "@/lib/image-url";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/**
 * A shop uploads the file its designer exported, not the file the page needs.
 *
 * Measured on this install before the fix: a 1254x1254 favicon at 489 KB served
 * as the browser tab icon — drawn at 16px, on every page — and a 293 KB wordmark
 * for a 50px-tall header mark. Together 782 KB, heavier than every script the
 * page loads, gzipped.
 *
 * Cloudinary resizes and re-encodes on delivery and caches the result, so this
 * costs one path segment and no re-upload. Verified against the live CDN:
 * 489 KB PNG -> 6.4 KB WebP, 293 KB PNG -> 15 KB WebP.
 */
describe("optimizedImageUrl", () => {
  const CLOUDINARY =
    "https://res.cloudinary.com/demo-cloud/image/upload/v1787403425/bakery-cms/abc123.png";

  it("asks Cloudinary for the rendered size", () => {
    const out = optimizedImageUrl(CLOUDINARY, { height: 50 });

    expect(out).toContain("/image/upload/f_auto,q_auto,");
    // Doubled for retina: a 50px mark is fetched at 100.
    expect(out).toContain("h_100");
    // `c_limit` never enlarges — a small original stays its own size.
    expect(out).toContain("c_limit");
    // The version and path are preserved exactly, or the image 404s.
    expect(out).toContain("/v1787403425/bakery-cms/abc123.png");
  });

  it("doubles width the same way", () => {
    expect(optimizedImageUrl(CLOUDINARY, { width: 32 })).toContain("w_64");
  });

  it("still re-encodes when no size is given", () => {
    // `f_auto,q_auto` alone is most of the win: format and quality, same pixels.
    const out = optimizedImageUrl(CLOUDINARY);
    expect(out).toContain("f_auto,q_auto");
    expect(out).not.toContain("c_limit");
  });

  it("leaves every other host alone", () => {
    // An admin may type a URL anywhere. Guessing at another CDN's parameters
    // produces a broken image, not a smaller one.
    for (const url of [
      "https://images.unsplash.com/photo-123?w=400",
      "/images/logo.svg",
      "https://example.com/logo.png",
      "https://res.cloudinary.example/demo/image/upload/v1/a.png",
    ]) {
      expect(optimizedImageUrl(url, { width: 50 }), url).toBe(url);
    }
  });

  it("does not stack a second transformation on one that is already there", () => {
    const already =
      "https://res.cloudinary.com/demo-cloud/image/upload/w_200,c_fill/v1787403425/a.png";
    expect(optimizedImageUrl(already, { width: 50 })).toBe(already);
  });

  it("returns blank input unchanged", () => {
    expect(optimizedImageUrl("")).toBe("");
    expect(optimizedImageUrl("   ")).toBe("");
  });
});

/**
 * The helper is worth nothing if the surfaces that draw these images skip it.
 */
describe("the surfaces that draw the shop's images", () => {
  const SURFACES: Array<[string, string]> = [
    ["app/layout.tsx", "the browser tab icon, on every page"],
    ["components/shared/brand-mark.tsx", "the storefront header and footer wordmark"],
    ["components/shared/app-brand-image.tsx", "the admin sidebar badge"],
    ["layouts/auth-layout.tsx", "the sign-in screens"],
  ];

  for (const [file, what] of SURFACES) {
    it(`${file.split("/").pop()} — ${what}`, () => {
      const src = source(file);
      expect(src, `${file} does not import the helper`).toContain(
        'from "@/lib/image-url"',
      );
      expect(src, `${file} imports the helper but never calls it`).toMatch(
        /optimizedImageUrl\(/,
      );
    });
  }

  it("passes a size everywhere the rendered box is known", () => {
    // `f_auto,q_auto` alone re-encodes but still ships the original pixels — a
    // 1254px square for a 32px badge. Every one of these draws into a fixed box.
    for (const file of [
      "app/layout.tsx",
      "components/shared/brand-mark.tsx",
      "components/shared/app-brand-image.tsx",
      "layouts/auth-layout.tsx",
    ]) {
      expect(source(file), file).toMatch(/optimizedImageUrl\([^)]*\{\s*(?:width|height):/);
    }
  });
});
