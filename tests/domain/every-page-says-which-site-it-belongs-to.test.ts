/**
 * A canonical URL's only job is to say WHICH host owns the page.
 *
 * Every static storefront route goes through `buildCanonicalUrl`, which puts
 * the shop's own domain in front of the path. The product pages — the ones a
 * bakery is actually found for — shipped `canonical: "/store/cakes/<slug>"`, a
 * bare path. There is no `metadataBase` anywhere to fill that in, so it reached
 * the browser relative, and a relative canonical cannot tell www from apex, or
 * staging from live. That is the one question it exists to answer.
 *
 * They also had no Open Graph tags at all, while every other route emits them —
 * so a cake shared to WhatsApp, which is how a bakery is passed around, arrived
 * as a bare link with no picture and no name.
 *
 * Source-level because the alternative is a running server and a live database;
 * the browser check for this lives in tests/e2e.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

/** Every storefront route file that builds its own metadata. */
function routesWithMetadata(): string[] {
  const found: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        walk(path);
        continue;
      }
      if (entry.name !== "page.tsx") continue;
      const code = stripComments(read(path));
      if (code.includes("generateMetadata") || /export const metadata/.test(code)) found.push(path);
    }
  };

  walk("app/(storefront)");
  return found.sort();
}

describe("a storefront page that names its own canonical", () => {
  const ROUTES = routesWithMetadata();

  it("found some to check", () => {
    expect(ROUTES.length, "no storefront route builds metadata — has the walk broken?").
      toBeGreaterThan(3);
  });

  it("never ships a bare path", () => {
    /**
     * A route may hand its canonical to `buildRouteMetadata*`, or build one with
     * `buildCanonicalUrl` — both put the shop's domain in front. What none of
     * them may do is write the path in by hand.
     */
    const offenders: string[] = [];

    for (const path of ROUTES) {
      const code = stripComments(read(path));
      for (const match of code.matchAll(/canonical:\s*([^,\n}]+)/g)) {
        const value = match[1].trim();
        // A literal starting with a slash, or a template that does.
        if (/^["'`]\//.test(value)) offenders.push(`${path} — canonical: ${value.slice(0, 50)}`);
      }
    }

    expect(
      offenders,
      "these canonicals name a path but no site:\n  " + offenders.join("\n  "),
    ).toEqual([]);
  });

  it("gives the product page a canonical AND a share card", () => {
    /**
     * Named, because this is the route the shop is found and shared by, and it
     * is the one that was missing both. The generic sweep above cannot see an
     * absent `openGraph` — nothing is there to match.
     */
    const code = stripComments(read("app/(storefront)/store/cakes/[slug]/page.tsx"));

    expect(code, "the product canonical no longer carries the shop's domain").toContain(
      "buildCanonicalUrl(",
    );
    expect(code, "a shared cake still arrives as a bare link").toContain("openGraph:");

    // The og:url has to be the same absolute URL, not a second opinion about
    // where the page lives.
    const og = code.slice(code.indexOf("openGraph:"), code.indexOf("twitter:"));
    expect(og, "the share card points somewhere other than the canonical").toContain(
      "url: canonical",
    );
    expect(og, "the share card carries no picture").toContain("images:");
  });
});

describe("the shop's own domain", () => {
  it("is the only thing the canonical builder trusts", () => {
    // Not `process.env`, not a header, not a hard-coded host: one setting the
    // owner controls, so changing it moves robots.txt, the sitemap, every
    // canonical and every share card together.
    const builder = stripComments(read("features/seo/lib/seo-metadata.ts"));
    const from = builder.indexOf("export function buildCanonicalUrl");
    expect(from, "the canonical builder is gone").toBeGreaterThan(-1);

    const body = builder.slice(from, builder.indexOf("\n}", from));
    expect(body).toContain("canonicalBaseUrl");
    expect(body, "the canonical builder reads the environment behind the owner's back").not.toMatch(
      /process\.env/,
    );
  });

  it("is not left as the reserved demo domain in the seed's own docs", () => {
    /**
     * `.example` is reserved by RFC 2606 so that it never resolves, which makes
     * it the right SEED — a shop that has not set its domain should have an
     * obviously fake one, not a real address belonging to somebody else.
     *
     * So this does not forbid it. It pins the reason, because the seed is one
     * edit away from becoming a plausible-looking domain nobody owns.
     */
    const repository = read("features/seo/lib/seo-repository.ts");
    const at = repository.indexOf("canonicalBaseUrl:");
    expect(at, "the seeded canonical base is gone").toBeGreaterThan(-1);

    expect(
      repository.slice(at, at + 120),
      "the seed points at a domain that might belong to someone",
    ).toContain(".example");
  });
});
