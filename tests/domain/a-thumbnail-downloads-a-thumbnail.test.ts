import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SafeImage } from "@/components/shared/safe-image";

/**
 * A 40px PICTURE DOWNLOADS A 40px PICTURE.
 *
 * Measured on the admin, 2026-10-16: the header avatar — 28px, on every admin
 * page — was the owner's 1.7 MB original; the products list drew ~80 KB
 * originals into 44px squares (763 KB for one screen); inventory, testimonials,
 * banners and the order page did the same. `SafeImage` now takes the width it
 * is drawn at and asks Cloudinary/Unsplash for that, and every list thumbnail
 * passes one.
 */
const ROOTS = ["apps", "components", "features"];

/** Draw the full stored file on purpose — each with the reason. */
const ORIGINAL_ON_PURPOSE: Record<string, string> = {
  // Printed: an invoice logo is rasterised at print resolution.
  "components/shared/invoice-document.tsx": "print",
  // Already passed through thumbnailImageUrl at the call.
  "apps/admin/media/components/media-thumbnail.tsx": "sized at the call",
  "apps/admin/media/components/photo-field.tsx": "sized at the call",
  "apps/admin/products/components/media-picker.tsx": "sized at the call",
  // The full-size preview of what the store will show.
  "apps/admin/products/components/product-preview-page.tsx": "the large preview",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("a thumbnail", () => {
  it("is asked for at the size it is drawn when SafeImage is told that size", () => {
    const html = renderToStaticMarkup(
      createElement(SafeImage, {
        src: "https://res.cloudinary.com/demo/image/upload/v1788/bakery-cms/cake.jpg",
        alt: "",
        width: 40,
      }),
    );
    expect(html).toContain("/image/upload/f_auto,q_auto,w_80,c_limit/v1788/");
  });

  it("is still the stored file when no size is given", () => {
    const html = renderToStaticMarkup(
      createElement(SafeImage, { src: "https://res.cloudinary.com/demo/image/upload/v1788/a.jpg", alt: "" }),
    );
    expect(html).toContain('src="https://res.cloudinary.com/demo/image/upload/v1788/a.jpg"');
  });

  it("is told its size at every SafeImage outside the deliberate originals", () => {
    const unsized: string[] = [];
    let seen = 0;
    for (const root of ROOTS) {
      for (const file of walk(join(process.cwd(), root))) {
        const rel = relative(process.cwd(), file).split(sep).join("/");
        if (rel === "components/shared/safe-image.tsx" || ORIGINAL_ON_PURPOSE[rel]) continue;
        const source = readFileSync(file, "utf8");
        for (const tag of source.matchAll(/<SafeImage\b[\s\S]*?\/>/g)) {
          seen += 1;
          if (!/\bwidth=\{\d+\}/.test(tag[0])) unsized.push(`${rel}: ${tag[0].replace(/\s+/g, " ").slice(0, 90)}`);
        }
      }
    }
    expect(seen, "found no SafeImage at all — the scan is not looking where they are").toBeGreaterThan(5);
    expect(unsized).toEqual([]);
  });
});
