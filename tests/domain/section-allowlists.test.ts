import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { allowlisted } from "@/lib/server/http/allowlist";

/**
 * Every `[section]` / `[key]` endpoint in this codebase is guarded the same way:
 * index a map of known sections, 404 when the lookup comes back falsy. A bare
 * index does not come back falsy for anything on `Object.prototype`.
 *
 * Ten sites across five features had that shape. Two were repaired by hand
 * earlier in this pass, which is exactly how the settings one got fixed while
 * its catalog twin did not — so this is one helper and one test, and the source
 * check below is what stops an eleventh being written the old way.
 *
 * Confirmed live before the fix: `GET /api/site-layout/constructor` and
 * `GET /api/content/toString` both answered 500, unauthenticated, on endpoints
 * whose reads are deliberately public.
 */
const INHERITED = [
  "constructor",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "__proto__",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString",
];

describe("looking a caller-supplied key up in a literal map", () => {
  const MAP = { header: "H", footer: "F", seo: "S" };

  for (const key of INHERITED) {
    it(`answers undefined for "${key}"`, () => {
      expect(allowlisted(MAP, key)).toBeUndefined();
      // The bare index this replaced did NOT — which is the whole defect.
      expect((MAP as Record<string, unknown>)[key]).not.toBeUndefined();
    });
  }

  it("still returns a real entry", () => {
    expect(allowlisted(MAP, "header")).toBe("H");
    expect(allowlisted(MAP, "seo")).toBe("S");
  });

  it("answers undefined for a key that simply is not there", () => {
    expect(allowlisted(MAP, "nope")).toBeUndefined();
    expect(allowlisted(MAP, "")).toBeUndefined();
  });

  it("does not confuse a stored undefined with an absent key in a way that matters", () => {
    // Callers treat undefined as "not a section", so a map holding an explicit
    // undefined behaves the same as one missing the key. Both must 404 rather
    // than reach the store or the validator.
    expect(allowlisted({ a: undefined } as Record<string, unknown>, "a")).toBeUndefined();
  });
});

/**
 * The helper only helps where it is used. These are the ten sites, named, so a
 * new endpoint written the old way shows up here rather than in production.
 */
describe("every section lookup goes through it", () => {
  const SITES = [
    ["features/site-layout/server/site-layout.controller.ts", "siteLayoutSchemas"],
    ["features/site-layout/server/site-layout.service.ts", "stores"],
    ["features/content/server/content.controller.ts", "contentSchemas"],
    ["features/content/server/content.service.ts", "stores"],
    ["features/communications/server/communications.controller.ts", "templateSchemas"],
    ["features/communications/server/communications.service.ts", "templateStores"],
    ["features/admin-config/server/admin-config.controller.ts", "adminConfigSchemas"],
    ["features/admin-config/server/admin-config.service.ts", "stores"],
    ["features/settings/server/settings.controller.ts", "sectionSchemas"],
    ["features/catalog/server/catalog.controller.ts", "catalogSectionSchemas"],
  ] as const;

  for (const [file, map] of SITES) {
    it(`${file} looks ${map} up safely`, () => {
      const source = readFileSync(join(process.cwd(), file), "utf8");

      expect(source).toContain(`allowlisted(${map},`);
      // The shape that was wrong: `map[key as SomeKey]`.
      expect(source).not.toMatch(new RegExp(`${map}\\[\\w+ as `));
    });
  }

  it("the reset endpoints, which had no validator to stop them, check membership too", () => {
    // These are worse than a 500: nothing threw, Mongoose dropped the write,
    // and the route answered 200 with an audit row for a section that does not
    // exist.
    for (const file of [
      "features/settings/server/settings.service.ts",
      "features/catalog/server/catalog.service.ts",
    ]) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).toContain("Object.hasOwn(SECTION_DEFAULTS, section)");
      expect(source, file).not.toContain("(section in SECTION_DEFAULTS)");
    }
  });
});
