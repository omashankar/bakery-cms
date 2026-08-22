import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * What ships in the seed becomes the shop's own words.
 *
 * This CMS is installed per shop, and every seed here is what a shop publishes
 * before anyone opens the admin. For a long time those seeds carried one
 * particular bakery's identity — its name, its Mumbai address, its 1800 number,
 * its Instagram handle, its founding year, its Twitter account, its canonical
 * domain — so every install advertised that shop instead of the one running it.
 *
 * It was not one stray literal. It was sixty-six of them across nine files, and
 * each was individually plausible: a placeholder here, a sample value there, a
 * default that "obviously" gets overwritten. What made it a class of bug rather
 * than a typo is that none of it is reachable by reading a page — it surfaces
 * only once a shop is live, in the browser tab, the invoice, the canonical tag,
 * the JSON-LD block and the `Sitemap:` line.
 *
 * The worst of them was `canonicalBaseUrl`. Seeded to a real competitor's live
 * domain, it pointed every canonical tag, `og:url` and sitemap entry the shop
 * published at somebody else's website.
 *
 * So this is the one assertion that would have caught all sixty-six at once:
 * no seed file may name a specific shop. Generic placeholders ("Your Bakery",
 * `your-bakery.example`) are fine — they read as placeholders, which is exactly
 * what stops them being mistaken for the shop's own copy.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/**
 * Every file whose contents become a fresh install's published data. Comments
 * count: they are how the next person learns what the seed is allowed to say.
 */
const SEED_SOURCES = [
  "constants/landing-data.ts",
  "constants/section-registry.ts",
  "features/seo/lib/seo-repository.ts",
  "features/content/lib/pages-repository.ts",
  "features/products/lib/products-repository.ts",
  "features/site-layout/lib/appearance-tokens.ts",
  "features/site-layout/lib/appearance-utils.ts",
  // Shipped `logoLetter: "M"` long after the name it was the initial of had
  // gone, and rendered it in the navbar beside whatever the shop called itself.
  "features/site-layout/lib/header-utils.ts",
  "features/communications/lib/template-sample-data.ts",
];

/**
 * A specific shop's identity, in the forms it actually took. Each entry was
 * found in a seed, not invented for this test.
 */
const SOMEONE_ELSES_IDENTITY = [
  "Monginis",
  "monginis",
  "Baker Street",
  "1800-123-4567",
  "Since 1956",
  "Since 1965",
  "India's beloved",
  "India's Favourite",
  "Six decades",
  "500+ cities",
  "zend-apps",
];

describe("the shipped seeds", () => {
  for (const path of SEED_SOURCES) {
    it(`${path} names no particular shop`, () => {
      const source = read(path);

      for (const token of SOMEONE_ELSES_IDENTITY) {
        expect(
          source,
          `${path} still ships "${token}", which every install would publish as its own`,
        ).not.toContain(token);
      }
    });
  }

  it("seeds the contact block blank rather than with a plausible address", () => {
    // Blank is load-bearing, not laziness. `defaultContactSettings` CREATES the
    // settings singleton, so a non-empty value here can never fail an "is it
    // filled in?" check — which is why a Mumbai address survived every earlier
    // cleanup. `chosen()` maps blank AND still-equal-to-shipped to "", and the
    // render sites omit the row entirely.
    const source = read("constants/landing-data.ts");
    const block = source.slice(
      source.indexOf("export const contactInfo"),
      source.indexOf("export const businessHours"),
    );

    expect(block, "contactInfo block not found").not.toBe("");

    for (const field of ["address", "phone", "email", "mapEmbedUrl"]) {
      expect(block, `contactInfo.${field} ships a value a shop never typed`).toContain(
        `${field}: ""`,
      );
    }
  });
});
