import { describe, expect, it } from "vitest";

import { thumbnailImageUrl } from "@/lib/image-url";

/**
 * THE MEDIA SCREEN DREW THIRTY ORIGINALS INTO 48px SQUARES.
 *
 * Every admin thumbnail was the stored URL — full-size PNGs from Cloudinary
 * and full-resolution Unsplash photos — so the Media screen downloaded 2.4 MB
 * and its largest paint landed at 11s on a throttled phone. The preview URL
 * asks the image host for the size the box actually is.
 */
describe("thumbnailImageUrl", () => {
  it("asks Cloudinary for a re-encoded image twice the box width", () => {
    const url = "https://res.cloudinary.com/demo/image/upload/v1790244321/bakery-cms/abc.png";
    expect(thumbnailImageUrl(url, 200)).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_400,c_limit/v1790244321/bakery-cms/abc.png",
    );
  });

  it("asks Unsplash for a sized, compressed image", () => {
    const out = new URL(thumbnailImageUrl("https://images.unsplash.com/photo-123?w=2000&h=1200", 160));
    expect(out.searchParams.get("w")).toBe("320");
    expect(out.searchParams.get("q")).toBe("70");
    expect(out.searchParams.get("auto")).toBe("format");
    expect(out.searchParams.has("h")).toBe(false);
  });

  it("leaves anything else exactly as stored", () => {
    for (const url of ["https://png.pngtree.com/a.png", "data:image/png;base64,AAAA", "/images/logo.svg", ""]) {
      expect(thumbnailImageUrl(url, 200)).toBe(url);
    }
  });
});
