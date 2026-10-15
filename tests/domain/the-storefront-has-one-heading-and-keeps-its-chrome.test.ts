import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

/** Source with comments removed, so a sentence ABOUT a tag cannot pass for one. */
const code = (file: string) =>
  read(file)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("the homepage's heading", () => {
  it("has exactly one h1, and it is the shop's name", () => {
    // The hero is usually artwork, so the audit found no h1 on the homepage.
    const home = code("apps/website/pages/store-home-page.tsx");
    expect(home.match(/<h1\b/g) ?? []).toHaveLength(1);
    expect(home).toMatch(/<h1 className="sr-only">\{[^}]*chrome\.siteName/);
  });

  it("does not let every hero slide add another", () => {
    // One h1 per text slide would put three on a page that should have one.
    expect(code("features/cms-sections/hero-carousel.tsx")).not.toMatch(/<h1\b/);
  });
});

describe("a /store URL nothing answers", () => {
  it("is answered inside the storefront layout, so the 404 keeps the shop around it", () => {
    // Left to the ROOT not-found it rendered outside every layout: no header,
    // no search, no cart, no footer.
    const page = code("app/(storefront)/store/[...missing]/page.tsx");
    expect(page).toContain('import { notFound } from "next/navigation";');
    expect(page).toMatch(/\{\s*notFound\(\);\s*\}/);
  });
});
