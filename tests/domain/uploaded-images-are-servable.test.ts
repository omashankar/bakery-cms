/**
 * A shop's own photographs have to be allowed to render.
 *
 * `next/image` fetches only from hosts listed in `images.remotePatterns`. The
 * list held one entry, `images.unsplash.com` — the host the SHIPPED DEMO
 * catalogue uses. Everything uploaded through the Media library goes to
 * Cloudinary, which serves from `res.cloudinary.com`, so a bakery that replaced
 * the demo photos with pictures of its own cakes got a storefront of empty
 * rectangles.
 *
 * REWRITTEN from a set of `readFileSync(next.config.ts)` + `toContain` greps.
 * Those asserted on the config's TEXT, which means they would have passed with
 * `remotePatterns` deleted outright as long as the strings survived in a
 * comment — and when the config was refactored, two of the four did exactly
 * that, matching prose in the new docblock. Every assertion here now goes
 * through the functions the config and the renderer both call.
 */
import { describe, expect, it } from "vitest";

import {
  classifyImageSrc,
  remoteImagePatterns,
  resolveCloudinaryCloudName,
} from "@/lib/images/image-hosts";

describe("the hosts next/image will fetch from", () => {
  const patterns = remoteImagePatterns("this-shop");

  it("serves the shop's own uploads", () => {
    expect(
      classifyImageSrc("https://res.cloudinary.com/this-shop/image/upload/v1/cake.jpg", patterns),
      "uploaded media renders unoptimised until this host is allowed",
    ).toBe("optimize");
  });

  it("still allows the demo catalogue's host, so a fresh install is not blank", () => {
    expect(classifyImageSrc("https://images.unsplash.com/photo-1", patterns)).toBe("optimize");
  });

  it("scopes Cloudinary to this shop's own account when one is configured", () => {
    // An unrestricted pattern lets anyone route arbitrary images through this
    // shop's image optimiser, which the Next docs warn about directly.
    expect(
      classifyImageSrc("https://res.cloudinary.com/someone-else/image/upload/v1/x.jpg", patterns),
    ).toBe("as-is");
  });

  it("leaves Cloudinary unscoped only when there is no account to scope to", () => {
    // Nothing is being uploaded without credentials, so there is nothing to
    // protect — and this is the SERVER's list, which keeps its original shape.
    const unconfigured = remoteImagePatterns(undefined);
    expect(unconfigured.find((p) => p.hostname === "res.cloudinary.com")?.pathname).toBe("/**");
  });

  it("reads the cloud name from either form of the credentials", () => {
    // lib/server/media/cloudinary.ts accepts CLOUDINARY_URL or the three
    // separate vars. A config that only understood one of them would leave
    // half the valid setups scoped to nothing.
    expect(resolveCloudinaryCloudName({ CLOUDINARY_CLOUD_NAME: "from-var" })).toBe("from-var");
    expect(resolveCloudinaryCloudName({ CLOUDINARY_URL: "cloudinary://k:s@from-url" })).toBe(
      "from-url",
    );
  });
});
