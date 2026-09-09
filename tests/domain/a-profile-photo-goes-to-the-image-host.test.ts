import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  MAX_INLINE_BYTES,
  MAX_SOURCE_BYTES,
} from "@/apps/admin/media/lib/use-media-upload";

/**
 * One photo box in this admin never learned to upload.
 *
 * Every other picture in the shop — product photos, the media library, a
 * customer's printed photo — goes through `shrinkImageFile` and then
 * `uploadMediaRequest`, and comes back as a URL. The admin's own profile photo
 * did neither. It read the file straight into a data URI and stored the whole
 * picture as text, behind a 2 MB gate that a phone camera clears in one shot,
 * with base64 adding a third on top.
 *
 * That string went into localStorage with the rest of the admin config, which
 * browsers cap near 5 MB. So one profile photo could fill the cache on its own
 * and every save afterwards would throw — which is exactly what happened: of
 * the 16 MB of base64 found in this shop's database, 2.3 MB was this one field.
 *
 * The migration that moved those ten images to the CDN fixed the value. This
 * fixes the box, which would otherwise have put a new one back the next time
 * anybody changed their picture.
 */

const PAGE = "apps/admin/profile/components/admin-profile-page.tsx";
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

/** The body of one function, so an assertion cannot pass off another. */
function bodyOf(source: string, signature: string): string {
  const start = source.indexOf(signature);
  expect(start, `${signature} is not in the file`).toBeGreaterThan(-1);
  const end = source.indexOf("\n  }", start);
  return source.slice(start, end);
}

describe("the profile photo takes the same road as every other photo", () => {
  const handler = () => bodyOf(code(PAGE), "async function handlePhoto(");

  it("no longer turns the file into text", () => {
    /**
     * `readAsDataURL` on the raw file IS the bug: it produces the whole
     * picture as a string, and everything downstream then has to carry it.
     * `shrinkImageFile` may still fall back to a data URI internally — that is
     * its business, and it resizes first.
     */
    expect(code(PAGE)).not.toContain("readAsDataURL");
    expect(code(PAGE)).not.toContain("new FileReader()");
  });

  it("shrinks it and hands it to the image host", () => {
    const body = handler();

    expect(body).toContain("await shrinkImageFile(file)");
    expect(body).toContain("await uploadMediaRequest(dataUrl");
  });

  it("keeps the URL when the host takes it", () => {
    expect(handler()).toContain('outcome.status === "uploaded"');
    expect(handler()).toContain("photoUrl: outcome.asset.url");
  });

  it("tells a refusal apart from having no host at all", () => {
    /**
     * The distinction `media-api.ts` exists to make. Treating a REFUSED upload
     * as "no image host" is how a shop that had Cloudinary configured silently
     * went back to writing base64 — under a green success toast, while being
     * told to add credentials it already had.
     */
    const body = handler();

    expect(body).toContain('outcome.status === "failed"');
    expect(body).toContain("Could not upload that photo");
    expect(body).toContain("Image storage is not configured");
  });

  it("falls back to storing the picture only when it is small enough to store", () => {
    /**
     * A shop with no image host still gets a photo, because refusing one
     * outright would be worse. But it is bounded by the same number the media
     * library is bounded by, and the shop is told the reason — rather than
     * finding out when its saves start failing.
     */
    const body = handler();

    expect(body).toContain("bytes > MAX_INLINE_BYTES");
    expect(body).toContain("photoUrl: dataUrl");
    // Read from the upload path, never re-typed here: two copies of a limit
    // drift, and this one decides whether a browser's storage survives.
    expect(code(PAGE)).toContain('from "@/apps/admin/media/lib/use-media-upload"');
  });

  it("stops using a limit of its own", () => {
    /**
     * It had `file.size > 2 * 1024 * 1024` — a number that appears nowhere else
     * in the shop, that no other photo box applies, and that is four times what
     * the browser can actually hold once the picture is base64.
     */
    expect(code(PAGE)).not.toContain("2 * 1024 * 1024");
    expect(handler()).toContain("file.size > MAX_SOURCE_BYTES");
  });

  it("borrows numbers that mean what this needs them to mean", () => {
    // A guard against the imports being kept while the values drift into
    // something that cannot protect a browser's storage.
    expect(MAX_INLINE_BYTES).toBeLessThanOrEqual(512 * 1024);
    expect(MAX_SOURCE_BYTES).toBeGreaterThan(MAX_INLINE_BYTES);
  });
});

describe("and the button says it is working", () => {
  it("shows a spinner and refuses a second press", () => {
    /**
     * A photo leaves the browser now, so there is a wait where there was none.
     * The obvious thing to do with a button that appears to have done nothing
     * is press it again.
     */
    const source = code(PAGE);

    expect(source).toContain("const [uploading, setUploading] = useState(false);");
    expect(source).toContain("setUploading(true);");
    expect(source).toContain("setUploading(false);");
    expect(source).toContain("disabled={uploading}");
    expect(source).toContain('aria-label={uploading ? "Uploading photo" : "Change photo"}');
  });

  it("clears the spinner however the upload ends", () => {
    // In `finally`, not on the success path: a host that refuses, or a file
    // that will not decode, would otherwise leave the button spinning for ever.
    expect(handlerFinally()).toContain("setUploading(false);");
  });

  it("lets the same file be chosen again", () => {
    /**
     * An <input type="file"> fires no change event when the value it already
     * holds is picked a second time. Somebody whose upload failed would find
     * the button dead until they chose a different picture.
     */
    expect(bodyOf(code(PAGE), "async function handlePhoto(")).toContain(
      'event.target.value = "";',
    );
  });
});

function handlerFinally(): string {
  const body = bodyOf(code(PAGE), "async function handlePhoto(");
  const at = body.indexOf("} finally {");
  expect(at, "handlePhoto has no finally block").toBeGreaterThan(-1);
  return body.slice(at);
}
