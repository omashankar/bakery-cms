/**
 * A replace-all write from something that has not read is a deletion.
 *
 * Both page builders PUT the entire section array they hold in memory. That
 * array starts `[]`, and it is still `[]` until the opening `fetchHomepageState()`
 * resolves — forever, if that fetch THREW, because the failure path only toasts.
 * Publish was live the whole time and `assertVersion` waved it through, because
 * a client that never read has no version to compare and the check returned
 * early on `undefined`.
 *
 * One click in that window published an empty array over the LIVE storefront
 * homepage. Nothing on screen hinted at it: the confirm dialog says only "This
 * updates the live /store homepage for everyone" and never names a section
 * count, and the same path exists for /store/wedding-cakes.
 *
 * `builder-conflict.ts` even asserted the invariant that was broken — "the two
 * writes that carry a client-held array always pass it".
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { assertVersion, BuilderConflictError } from "@/features/cms-sections/lib/builder-conflict";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("a write that carries a client-held array", () => {
  it("is refused when the caller cannot say which version it edited", () => {
    expect(() => assertVersion({ version: 7 }, undefined)).toThrow(BuilderConflictError);
  });

  it("reports the version the caller must reload to, not a bare failure", () => {
    // The customer-facing half of the guard: "reload before saving" is only
    // actionable if the caller is told what it is reloading to.
    try {
      assertVersion({ version: 12 }, undefined);
      throw new Error("should have refused");
    } catch (error) {
      expect(error).toBeInstanceOf(BuilderConflictError);
      expect((error as BuilderConflictError).currentVersion).toBe(12);
    }
  });

  it("is refused when the caller read an older version", () => {
    expect(() => assertVersion({ version: 9 }, 8)).toThrow(BuilderConflictError);
  });

  it("goes through when the caller read the version on disk", () => {
    expect(() => assertVersion({ version: 9 }, 9)).not.toThrow();
  });

  it("treats a document written before versioning as 0", () => {
    expect(() => assertVersion({}, 0)).not.toThrow();
    expect(() => assertVersion(null, 0)).not.toThrow();
  });
});

describe("both builders", () => {
  const stores = [
    "features/cms-sections/data/homepage-sections.server.ts",
    "features/cms-sections/data/wedding-sections.server.ts",
  ];

  it("puts the guard on every write that replaces the whole layout", () => {
    for (const path of stores) {
      const source = read(path);
      // Save draft AND publish — a versionless draft save destroys the other
      // admin's work just as thoroughly, it just does not reach the storefront.
      expect(
        (source.match(/assertVersion\(state, expectedVersion\)/g) ?? []).length,
        `${path} does not guard both writes`,
      ).toBe(2);
    }
  });
});

describe("the builder screens", () => {
  const pages = [
    "apps/admin/builders/homepage/homepage-builder-page.tsx",
    "apps/admin/builders/wedding/wedding-builder-page.tsx",
  ];

  it("track whether the layout was actually read, not merely that mounting finished", () => {
    for (const path of pages) {
      const source = read(path);
      // `mounted` is set in a `finally`, so it is true after a FAILED read too.
      expect(source, `${path} has no read-succeeded flag`).toContain("loadedLayout");
      expect(source).toContain("setLoadedLayout(true)");
      expect(source).toContain("hasLoaded={loadedLayout}");
    }
  });

  it("sets that flag only on the success path", () => {
    for (const path of pages) {
      const source = read(path);
      const set = source.indexOf("setLoadedLayout(true)");
      const catchAt = source.indexOf("} catch {", set);
      // The flag is set before the catch that follows it in the same try block,
      // i.e. inside the try, so a throw skips it.
      expect(set, `${path} never sets the flag`).toBeGreaterThan(-1);
      expect(catchAt, `${path} sets the flag outside the try`).toBeGreaterThan(set);
    }
  });

  it("does not offer a button that cannot succeed", () => {
    const toolbar = read("apps/admin/builders/shared/builder-toolbar.tsx");

    expect(toolbar).toContain("hasLoaded");
    // Publish especially: it is the one that reaches the storefront.
    expect(toolbar).toContain("disabled={isSaving || !hasLoaded}");
    expect(toolbar).toContain("disabled={isSaving || !isDirty || !hasLoaded}");
  });
});
