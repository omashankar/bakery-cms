import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE USAGE INDEX ASKED A ROUTE THAT NO LONGER EXISTED, AND NEVER FINISHED.
 *
 * The wedding builder was removed with its API; Media kept asking
 * `/api/wedding-sections`. A 404 is "incomplete", so the index never called
 * itself ready: every delete dialog sat on "Still checking", and each visit
 * re-fired all the sources three more times.
 *
 * Every URL the index reads must be a route this app serves.
 */
const source = readFileSync(
  join(process.cwd(), "apps/admin/media/lib/use-media-usage-sync.ts"),
  "utf8",
);
const urls = [...source.matchAll(/url: "(\/api\/[^"]+)"/g)].map((m) => m[1]);

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

describe("the media usage index", () => {
  it("reads at least the documents that hold images", () => {
    expect(urls).toEqual(expect.arrayContaining(["/api/catalog", "/api/products", "/api/homepage-sections"]));
  });

  it.each(urls)("%s is a route this app serves", (url) => {
    expect(resolves(url.split("/").filter(Boolean), join(process.cwd(), "app"))).toBe(true);
  });
});
