/**
 * A shop's own photographs have to be allowed to render.
 *
 * `next/image` fetches only from hosts listed in `images.remotePatterns`;
 * anything else answers 400 and renders as a blank box. The list held one
 * entry, `images.unsplash.com` — the host the SHIPPED DEMO catalogue uses.
 * Everything uploaded through the Media library goes to Cloudinary, which
 * serves from `res.cloudinary.com`, so a bakery that replaced the demo photos
 * with pictures of its own cakes got a storefront of empty rectangles.
 *
 * Read from the config file rather than imported: next.config.ts resolves the
 * cloud name from the environment at load time, and this test is about what
 * ships, not about what one machine's env produces.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

describe("the hosts next/image will fetch from", () => {
  it("includes the one the shop's own uploads are served from", () => {
    expect(
      config,
      "uploaded media renders as a blank box until this host is allowed",
    ).toContain("res.cloudinary.com");
  });

  it("still allows the demo catalogue's host, so a fresh install is not blank", () => {
    expect(config).toContain("images.unsplash.com");
  });

  it("scopes Cloudinary to this shop's own account when one is configured", () => {
    // An unrestricted pattern lets anyone route arbitrary images through this
    // shop's image optimiser, which the Next docs warn about directly.
    expect(config).toContain("cloudinaryCloudName ?");
    expect(config).toContain("/${cloudinaryCloudName}/**");
  });

  it("reads the cloud name from either form of the credentials", () => {
    // lib/server/media/cloudinary.ts accepts CLOUDINARY_URL or the three
    // separate vars. A config that only understood one of them would leave
    // half the valid setups scoped to nothing.
    expect(config).toContain("CLOUDINARY_CLOUD_NAME");
    expect(config).toContain("CLOUDINARY_URL");
  });
});
