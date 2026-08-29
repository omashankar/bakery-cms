/**
 * `POST /api/media/upload` must not be able to read this server's disk.
 *
 * The Cloudinary SDK decides what an upload source is by pattern. `isRemoteUrl`
 * matches only ftp/http/https/gs/s3/data; ANYTHING else is treated as a path on
 * the local filesystem and streamed up with `fs.createReadStream(file)`, and the
 * response hands back a public `secure_url` for it.
 *
 * `uploadSchema.source` was `z.string().min(1)`, so the endpoint accepted
 * `D:\GitHub\bakery-cms\.env.local` and published MONGODB_URI, the three JWT
 * secrets and CLOUDINARY_API_SECRET to a CDN — gated only by the owner/admin
 * role a bakery hands its shop manager.
 *
 * Asserted against the SCHEMA rather than through the route: the schema is where
 * the decision is made, and a route test would need a session, a database and a
 * Cloudinary account to reach it.
 */
import { describe, expect, it } from "vitest";

import { uploadSchema } from "@/features/media/server/media.validators";

function accepts(source: string): boolean {
  return uploadSchema.safeParse({ source }).success;
}

describe("what the upload endpoint accepts as a source", () => {
  /**
   * Eight of these parse happily as a Cloudinary "local file". The Windows path
   * is the one worth staring at: it is NOT rejected by `new URL()` throwing,
   * because `D:` is a single-letter scheme and the string parses with protocol
   * `"d:"`. A guard written as "reject what fails to parse" would let it past.
   */
  const readsTheDisk = [
    "D:\\GitHub\\bakery-cms\\.env.local",
    "C:\\Windows\\System32\\drivers\\etc\\hosts",
    "/etc/passwd",
    "package.json",
    "./.env.local",
  ];

  it.each(readsTheDisk)("refuses the local path %s", (source) => {
    expect(accepts(source), `${source} would be read off this server's disk`).toBe(false);
  });

  /** Schemes Cloudinary fetches from that this shop has no reason to allow. */
  const otherSchemes = [
    "ftp://example.com/photo.jpg",
    "s3://a-bucket/photo.jpg",
    "gs://a-bucket/photo.jpg",
    "http://example.com/photo.jpg",
  ];

  it.each(otherSchemes)("refuses %s", (source) => {
    expect(accepts(source)).toBe(false);
  });

  it("refuses a data URI that is not an image", () => {
    // `data:` alone is not enough — this is a valid data URI and Cloudinary
    // would have stored it.
    expect(accepts("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==")).toBe(false);
  });

  /**
   * The important half.
   *
   * Both real sources must keep working, so that nobody later "hardens" this by
   * rejecting remote URLs outright — the import-on-paste path in
   * apps/admin/media/lib/use-media-upload.ts depends on the https one, and every
   * file chosen in the browser arrives as the data one.
   */
  it("still accepts an https image URL, which is how a pasted link is imported", () => {
    expect(accepts("https://i.pinimg.com/originals/d7/f1/d3/d7f1d32039d0955b588078b7ae9d155c.jpg")).toBe(
      true,
    );
  });

  it("still accepts a base64 image data URI, which is how an uploaded file arrives", () => {
    expect(accepts("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB")).toBe(true);
    expect(accepts("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBe(true);
  });

  it("still requires something", () => {
    expect(accepts("")).toBe(false);
  });
});
