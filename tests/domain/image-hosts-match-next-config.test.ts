/**
 * The hand-rolled matcher must agree with the one Next actually uses.
 *
 * components/shared/optimized-image.tsx decides in the BROWSER whether a src is
 * safe to hand to the optimiser. It cannot import Next's `match-remote-pattern`
 * to do it — that module pulls in a whole picomatch build, weight every
 * storefront page would then carry — so lib/images/image-hosts.ts reimplements
 * the one glob shape this config ships.
 *
 * A reimplementation is only safe while something proves it still agrees. That
 * is this file. Without it, `matches()` is exactly the hand-duplication the
 * shared module exists to prevent.
 */
import { hasRemoteMatch } from "next/dist/shared/lib/match-remote-pattern";
import { describe, expect, it } from "vitest";

import nextConfig from "@/next.config";
import {
  classifyImageSrc,
  remoteImagePatterns,
  resolveCloudinaryCloudName,
  type RemoteImagePattern,
} from "@/lib/images/image-hosts";

const shipped = nextConfig.images?.remotePatterns as RemoteImagePattern[] | undefined;

describe("next.config.ts and the shared list", () => {
  it("loads the config at all, through its relative .ts import", () => {
    // Also the guard on step one of this change: next.config.ts now imports
    // lib/images/image-hosts.ts by relative path. If that ever stops resolving,
    // the failure should be one obvious assertion rather than a broken build.
    expect(shipped).toBeDefined();
    expect(shipped).toHaveLength(2);
  });

  it("ships exactly what the shared list produces", () => {
    // Fails the moment anyone re-inlines a literal array into the config.
    expect(shipped).toEqual(remoteImagePatterns(resolveCloudinaryCloudName()));
  });
});

describe("our matcher against Next's own", () => {
  /**
   * Absolute https URLs only. classifyImageSrc has branches Next's matcher has
   * no opinion about (data:, blob:, .svg, local paths), and comparing those
   * would be comparing two different questions.
   */
  const urls = [
    "https://images.unsplash.com/photo-1",
    "https://images.unsplash.com/photo-1?w=600&q=80",
    "https://i.pinimg.com/originals/d7/f1/d3/d7f1d32039d0955b588078b7ae9d155c.jpg",
    "https://res.cloudinary.com/demo-cloud/image/upload/v1/cake.jpg",
    "https://res.cloudinary.com/someone-else/image/upload/v1/cake.jpg",
    "https://res.cloudinary.com/",
    "https://images.unsplash.com.evil.test/photo-1",
    "https://evil.test/images.unsplash.com/photo-1",
    "https://lh3.googleusercontent.com/a/photo",
    "https://scontent.cdninstagram.com/v/t51/photo.jpg",
    "https://example.com/cake.png",
    "https://sub.images.unsplash.com/photo-1",
  ];

  const patterns = remoteImagePatterns("demo-cloud");

  it.each(urls)("agrees on %s", (url) => {
    const ours = classifyImageSrc(url, patterns) === "optimize";
    const theirs = hasRemoteMatch([], patterns, new URL(url));
    expect(ours, `our verdict disagrees with next/image for ${url}`).toBe(theirs);
  });

  it("is comparing something, not an all-false table", () => {
    // Anti-vacuity: if every URL stopped matching, the table above would pass
    // while proving nothing about the matcher.
    const verdicts = urls.map((u) => hasRemoteMatch([], patterns, new URL(u)));
    expect(verdicts.filter(Boolean).length).toBeGreaterThan(0);
    expect(verdicts.filter((v) => !v).length).toBeGreaterThan(0);
  });
});
