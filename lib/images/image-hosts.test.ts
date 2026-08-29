/**
 * What may be handed to next/image's optimiser, and what must not be.
 *
 * Driven from an EXPLICIT pattern list rather than the ambient environment, so
 * the answers do not depend on whose `.env.local` happens to be loaded.
 *
 * Note that vitest can never reproduce the underlying crash: image-loader.js:96
 * skips the host check when `NODE_ENV === 'test'`. So this file tests the
 * DECISION, and tests/domain/a-foreign-image-does-not-reach-next-image.test.ts
 * tests that the renderer acts on it.
 */
import { describe, expect, it } from "vitest";

import {
  classifyImageSrc,
  clientImagePatterns,
  isForeignImageHost,
  remoteImagePatterns,
  resolveCloudinaryCloudName,
} from "./image-hosts";

const PATTERNS = remoteImagePatterns("demo-cloud");

/** The URL from the reported crash, kept verbatim. */
const REPORTED =
  "https://i.pinimg.com/originals/d7/f1/d3/d7f1d32039d0955b588078b7ae9d155c.jpg";

describe("classifyImageSrc", () => {
  const optimize = [
    "https://images.unsplash.com/photo-1?w=600",
    "https://res.cloudinary.com/demo-cloud/image/upload/v1/cake.jpg",
    "/uploads/logo.png",
  ];

  it.each(optimize)("optimises %s", (src) => {
    expect(classifyImageSrc(src, PATTERNS)).toBe("optimize");
  });

  const asIs: [string, string][] = [
    [REPORTED, "the reported foreign host"],
    [
      "https://res.cloudinary.com/someone-else/image/upload/v1/x.jpg",
      "another shop's Cloudinary account — the case a bare hostname check gets wrong",
    ],
    ["http://images.unsplash.com/photo-1", "an allowed host over plain http"],
    ["//images.unsplash.com/photo-1", "protocol-relative (E360)"],
    ["hello", "not a URL at all (E63)"],
    ["/uploads/logo.png?v=2", "a local path carrying a query string (E871)"],
    ["https://images.unsplash.com/logo.svg", "SVG, which next/image serves as-is anyway"],
    ["data:image/png;base64,iVBOR", "a data URI, which next/image already forces unoptimized"],
    ["   https://images.unsplash.com/photo-1   ", "padded — trimmed, then optimised"],
  ];

  it.each(asIs)("renders %s as-is (%s)", (src, _why) => {
    // The padded row is the exception: trimming makes it an allowed host.
    const expected = src.trim() === "https://images.unsplash.com/photo-1" ? "optimize" : "as-is";
    expect(classifyImageSrc(src, PATTERNS)).toBe(expected);
  });

  const placeholder: [unknown, string][] = [
    ["", "empty"],
    ["   ", "whitespace only"],
    [null, "null"],
    [undefined, "undefined"],
    [0, "a number out of untyped Mongo"],
    [{}, "an object out of untyped Mongo"],
    ["blob:http://localhost/abc", "a blob URL, dead across a reload"],
  ];

  it.each(placeholder)("has nothing to render for %s (%s)", (src, _why) => {
    expect(classifyImageSrc(src, PATTERNS)).toBe("placeholder");
  });

  it("is not answering everything the same way", () => {
    // Anti-vacuity: a stub returning one constant fails the tables above, and
    // this pins that the tables really do exercise all three verdicts.
    const verdicts = new Set([
      classifyImageSrc(optimize[0], PATTERNS),
      classifyImageSrc(REPORTED, PATTERNS),
      classifyImageSrc("", PATTERNS),
    ]);
    expect(verdicts).toEqual(new Set(["optimize", "as-is", "placeholder"]));
  });
});

describe("the browser's pattern list fails closed", () => {
  const cloudinaryUrl = "https://res.cloudinary.com/demo-cloud/image/upload/v1/cake.jpg";

  it("optimises this shop's own Cloudinary images when the cloud name reached the bundle", () => {
    expect(classifyImageSrc(cloudinaryUrl, clientImagePatterns("demo-cloud"))).toBe("optimize");
  });

  it("renders them as-is rather than risking a throw when it did not", () => {
    /**
     * The whole point. The server's list falls back to a permissive `/**` when
     * no cloud name is configured; if the browser copied that it would classify
     * a stranger's Cloudinary URL as "optimize" and throw — this bug, delivered
     * by its own fix. Unknown must cost optimisation, never the page.
     */
    expect(clientImagePatterns(undefined).some((p) => p.hostname === "res.cloudinary.com")).toBe(
      false,
    );
    expect(classifyImageSrc(cloudinaryUrl, clientImagePatterns(undefined))).toBe("as-is");
  });

  it("still allows the demo catalogue's host, so a fresh install is not blank", () => {
    expect(classifyImageSrc("https://images.unsplash.com/photo-1", clientImagePatterns(undefined))).toBe(
      "optimize",
    );
  });
});

describe("isForeignImageHost", () => {
  it("is true only for a host this shop does not control", () => {
    expect(isForeignImageHost(REPORTED, PATTERNS)).toBe(true);
    expect(
      isForeignImageHost("https://res.cloudinary.com/someone-else/image/upload/v1/x.jpg", PATTERNS),
    ).toBe(true);
  });

  it("does not call the shop's own SVG logo foreign", () => {
    /**
     * The bug this exists for. `classifyImageSrc` answers "as-is" for ANY .svg,
     * because next/image serves SVG unoptimised — so a hint driven by that told
     * the shop their freshly uploaded logo was loading from someone else's site.
     */
    const ownLogo = "https://res.cloudinary.com/demo-cloud/image/upload/v1/logo.svg";
    expect(classifyImageSrc(ownLogo, PATTERNS)).toBe("as-is");
    expect(isForeignImageHost(ownLogo, PATTERNS)).toBe(false);
  });

  it("has nothing to say about images that have no other host", () => {
    expect(isForeignImageHost("data:image/png;base64,iVBOR", PATTERNS)).toBe(false);
    expect(isForeignImageHost("/uploads/logo.png", PATTERNS)).toBe(false);
    expect(isForeignImageHost("", PATTERNS)).toBe(false);
    expect(isForeignImageHost(null, PATTERNS)).toBe(false);
    expect(isForeignImageHost("hello", PATTERNS)).toBe(false);
  });
});

describe("resolveCloudinaryCloudName", () => {
  it("reads the separate variable", () => {
    expect(resolveCloudinaryCloudName({ CLOUDINARY_CLOUD_NAME: "a-shop" })).toBe("a-shop");
  });

  it("reads the combined URL form, which lib/server/media/cloudinary.ts also accepts", () => {
    expect(resolveCloudinaryCloudName({ CLOUDINARY_URL: "cloudinary://key:secret@b-shop" })).toBe(
      "b-shop",
    );
  });

  it("prefers the explicit variable over the URL", () => {
    expect(
      resolveCloudinaryCloudName({
        CLOUDINARY_CLOUD_NAME: "a-shop",
        CLOUDINARY_URL: "cloudinary://key:secret@b-shop",
      }),
    ).toBe("a-shop");
  });

  it("is undefined when nothing is configured, and survives a malformed URL", () => {
    expect(resolveCloudinaryCloudName({})).toBeUndefined();
    expect(resolveCloudinaryCloudName({ CLOUDINARY_URL: "not a url" })).toBeUndefined();
  });
});
