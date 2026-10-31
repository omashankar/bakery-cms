import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { mediaAddresses } from "@/features/media/server/media.usage";
import { MEDIA_USAGE_URL } from "@/apps/admin/media/lib/use-media-usage-sync";

/**
 * THE USAGE INDEX ASKED A ROUTE THAT NO LONGER EXISTED, AND NEVER FINISHED.
 *
 * The wedding builder was removed with its API; Media kept asking
 * `/api/wedding-sections`. A 404 is "incomplete", so the index never called
 * itself ready: every delete dialog sat on "Still checking", and each visit
 * re-fired all the sources three more times.
 *
 * The documents are read on the server now (media.usage.ts), whole and with
 * the server's own access — so a manager, refused the pages, and anyone handed
 * a visitor's banners, no longer get an index with holes in it.
 */

/** Walk app/ segment by segment, letting a `[param]` folder match any segment. */
function resolves(segments: string[], dir: string): boolean {
  if (segments.length === 0) return existsSync(join(dir, "route.ts"));
  const [head, ...rest] = segments;
  if (existsSync(join(dir, head)) && resolves(rest, join(dir, head))) return true;
  const dynamic = existsSync(dir)
    ? readdirSync(dir).filter((name) => name.startsWith("[") && name.endsWith("]") && !name.startsWith("[."))
    : [];
  return dynamic.some((name) => resolves(rest, join(dir, name)));
}

const server = readFileSync(join(process.cwd(), "features/media/server/media.usage.ts"), "utf8");
const sourceList = server.slice(server.indexOf("const SOURCES"), server.indexOf("];", server.indexOf("const SOURCES")));

describe("the media usage index", () => {
  it("asks a route this app serves", () => {
    expect(resolves(MEDIA_USAGE_URL.split("/").filter(Boolean), join(process.cwd(), "app"))).toBe(true);
  });

  it.each([
    ["the logo", "getSettings()"],
    ["banners, switched-off ones too", 'getContent("banners")'],
    ["the homepage, draft included", "getHomepageState()"],
    ["the catalog", "getCatalog()"],
    ["every product, drafts included", "getProducts()"],
    ["CMS pages, drafts included", "getPages()"],
    ["testimonials", 'getContent("testimonials")'],
    ["the header", 'getSiteLayout("header")'],
    ["the footer", 'getSiteLayout("footer")'],
    ["SEO", 'getSiteLayout("seo")'],
  ])("reads %s on the server", (_what, call) => {
    expect(sourceList).toContain(call);
  });
});

describe("only the addresses leave the server", () => {
  const HERO = "https://res.cloudinary.com/shop/image/upload/v1/hero.jpg";

  it("finds an address in a field of its own and inside a page's HTML", () => {
    const draft = {
      title: "Diwali launch — not announced yet",
      blocks: [{ content: `<p>Secret copy</p><img src="${HERO}" alt="">` }],
      seo: { ogImage: "/uploads/og/diwali.webp" },
    };
    expect(mediaAddresses(draft).sort()).toEqual(["/uploads/og/diwali.webp", HERO].sort());
  });

  it("carries none of the words", () => {
    const text = mediaAddresses({ title: "Diwali launch", body: "Secret copy, 20% off" }).join("\n");
    expect(text).toBe("");
  });
});
