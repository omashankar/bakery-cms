import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createEmptyPageForm } from "@/features/content/lib/pages-repository";

/**
 * The About page may not put words in a shop's mouth.
 *
 * Its template hardcoded the DEMO brand's history and rendered it as whichever
 * shop was running the CMS: "Since 1965", "60+ Years of baking", "1M+ Happy
 * customers", "500+ Cake varieties", "4.9★ Average rating", "Six decades of
 * craft, quality, and care", and four cards claiming six decades of expertise
 * and same-day delivery across 500+ cities. There was no field anywhere to
 * change or remove any of it, so every bakery publishing that page published
 * someone else's past as its own — and the delivery claim contradicted the
 * shop's own `deliveryLeadDays` on the same site.
 *
 * They are page data now, and an empty value renders nothing at all.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const TEMPLATE = "apps/website/components/cms-page-view.tsx";

/** Every claim that used to be baked into the template. */
const CLAIMS = [
  "Since 1965",
  "Baking joy for generations",
  "60+",
  "1M+",
  "500+",
  "4.9★",
  "Years of baking",
  "Happy customers",
  "Cake varieties",
  "Average rating",
  "Six decades of craft",
  "Why Choose Us",
  "Our Story",
  "Ready to make your celebration sweeter?",
];

describe("the About template", () => {
  it("no longer states any of the demo brand's history itself", () => {
    const source = read(TEMPLATE);

    for (const claim of CLAIMS) {
      // Comments explain the fix and legitimately quote the old copy; only
      // rendered strings matter.
      const rendered = source
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/[^\n]*/g, " ");

      expect(rendered, `the template still asserts "${claim}"`).not.toContain(claim);
    }
  });

  it("does not import the shared demo copy any more", () => {
    expect(read(TEMPLATE)).not.toContain('from "@/constants/landing-data"');
  });

  it("left no consumer of the shared demo copy behind", () => {
    /**
     * `whyChooseUs` outlived this template.
     *
     * When the About page stopped rendering it, the wedding page was still its
     * consumer — so the constant stayed, and this test asserted so, to stop
     * anyone deleting it and blanking that page. The wedding section now reads
     * its own editable cards too, which left the constant with no consumer at
     * all, so it is gone. Asserted the other way round now: nothing should
     * reintroduce a shared module of claims for two pages to render as their
     * own.
     */
    expect(read("constants/landing-data.ts")).not.toContain("export const whyChooseUs");
  });

  it("gates every section on its own content", () => {
    const source = read(TEMPLATE);

    // The four sections that must disappear rather than render empty.
    expect(source).toContain("about.stats.length > 0");
    expect(source).toMatch(/about\.highlightsTitle \|\| about\.highlightsDescription/);
    expect(source).toMatch(/about\.ctaTitle \|\| about\.ctaDescription/);
    expect(source).toMatch(/about\.badgeTitle \|\| about\.badgeSubtitle/);
  });
});

describe("a brand-new page", () => {
  it("starts with no claim in it", () => {
    const form = createEmptyPageForm();

    expect(form.about).toBeDefined();
    expect(form.about?.badgeTitle).toBe("");
    expect(form.about?.stats).toEqual([]);
    expect(form.about?.highlights).toEqual([]);
    expect(form.about?.ctaTitle).toBe("");
  });

  it("carries its About fields as empty strings, never undefined", () => {
    /**
     * `undefined` cannot clear a stored value: the client stringifies its patch,
     * which drops undefined keys, and the server shallow-merges — so the old
     * value survives while the form looks cleared until reload. Empty strings
     * are the only thing that persists a clear.
     */
    const about = createEmptyPageForm().about ?? {};

    for (const [key, value] of Object.entries(about)) {
      if (Array.isArray(value)) continue;
      expect(value, `${key} is undefined, so it can never be cleared`).toBe("");
    }
  });
});

describe("the seeded About page", () => {
  it("does not ship the demo history as a shop's own data", () => {
    // `seedPages` is the Mongo seed too, so anything here becomes every new
    // shop's About page. Putting the old constants in it would republish the
    // demo brand's past as theirs — the exact defect being fixed.
    const repository = read("features/content/lib/pages-repository.ts");
    const seedStart = repository.indexOf("seedPages");
    const seedEnd = repository.indexOf("export function", seedStart + 10);
    const seed = repository.slice(seedStart, seedEnd > 0 ? seedEnd : undefined);

    for (const claim of ["Since 1965", "1M+", "60+", "500+", "Six decades"]) {
      expect(seed, `the seed ships "${claim}"`).not.toContain(claim);
    }
  });
});
