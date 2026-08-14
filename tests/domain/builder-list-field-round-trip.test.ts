import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  HOMEPAGE_SECTION_REGISTRY,
  limitRows,
  parseListField,
  photoRows,
  renderableRows,
} from "@/constants/section-registry";
import { WEDDING_SECTION_REGISTRY } from "@/constants/wedding-section-registry";

/**
 * A list field has to survive the round trip its own editor makes.
 *
 * The editor keeps no draft of its own: it re-reads through `parseListField` on
 * every render and writes straight back. So anything the READ discards is
 * discarded from under the admin's cursor.
 *
 * It used to drop all-empty rows and trim every value on read. Both broke it:
 * "Add row" wrote a blank row that the very next read deleted, making the
 * button a no-op on every list field in the builder; and clearing a row's last
 * non-empty column deleted the row mid-edit. Deciding what is worth SHOWING is
 * the renderer's job, which is what `renderableRows` is for.
 */

const stored = (rows: Record<string, string>[]) => ({ items: JSON.stringify(rows) });

describe("reading a list field", () => {
  it("keeps a blank row, so Add can be typed into", () => {
    const rows = parseListField(stored([{ value: "", label: "" }]), "items");

    expect(rows, "the row the editor just added was dropped on read").toHaveLength(1);
    expect(rows[0]).toEqual({ value: "", label: "" });
  });

  it("keeps a row whose last value was just cleared", () => {
    // The admin selects the text to retype it. The row must not vanish.
    const rows = parseListField(stored([{ label: "" }, { label: "Kept" }]), "items");

    expect(rows).toHaveLength(2);
  });

  it("keeps a trailing space, which a controlled input has to be able to show", () => {
    const rows = parseListField(stored([{ label: "Bespoke " }]), "items");

    expect(rows[0].label).toBe("Bespoke ");
  });

  it("still refuses anything it cannot read, without inventing a default", () => {
    expect(parseListField({}, "items")).toEqual([]);
    expect(parseListField({ items: "not json" }, "items")).toEqual([]);
    expect(parseListField({ items: JSON.stringify({ nope: 1 }) }, "items")).toEqual([]);
    expect(parseListField({ items: 42 }, "items")).toEqual([]);
  });
});

describe("rendering a list field", () => {
  it("drops the rows the admin left blank", () => {
    const rows = renderableRows([
      { value: "", label: "" },
      { value: " ", label: "" },
      { value: "27", label: "Reviews" },
    ]);

    expect(rows).toEqual([{ value: "27", label: "Reviews" }]);
  });

  it("drops a photo row that has no photo, whatever else is typed on it", () => {
    /**
     * `renderableRows` keeps any row with one non-blank column, which is right
     * for a stat and wrong for a picture. An admin who typed the caption and
     * was interrupted before choosing the image left a row that passed it, and
     * that row reached `<Image src="">` — a broken tile sitting among the
     * shop's real photographs.
     */
    const rows = photoRows(
      stored([
        { image: "", title: "Anniversary three-tier", tag: "Wedding" },
        { image: "   ", title: "", tag: "" },
        { image: "/u/cake.jpg", title: "", tag: "" },
      ]),
      "items",
    );

    expect(rows).toEqual([{ image: "/u/cake.jpg", title: "", tag: "" }]);
  });

  it("treats a cleared 'max' box as no limit rather than as none", () => {
    /**
     * The builder's number input writes `Number(value) || 0`, so selecting
     * "Max images shown" to retype it stores 0 mid-keystroke. `slice(0, 0)` is
     * empty, and these sections render nothing when empty — so clearing that
     * one box deleted the heading, the photos and the CTA from the live page
     * while the photo list stayed full.
     */
    const rows = [{ a: "1" }, { a: "2" }, { a: "3" }];

    expect(limitRows(rows, 0)).toHaveLength(3);
    expect(limitRows(rows, -1)).toHaveLength(3);
    expect(limitRows(rows, 2)).toHaveLength(2);
  });
});

describe("every list field", () => {
  /**
   * A field the section's renderer never reads is an editor for nothing, and a
   * key the renderer reads with no field is a section nobody can fill in.
   *
   * Both happened at once: the why-us `items` field was registered on the
   * `our-menu` entry, so Menu Strip grew a Cards editor its renderer ignores
   * while Why Choose Us — the only reader of `items` — had no field at all and
   * rendered null forever.
   */
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  /**
   * The component the renderer's own `switch (section.type)` dispatches to.
   *
   * Checking the whole FILE for the key is what the first version of this test
   * did, and it could not fail for the regression it is named after: move
   * `items` back onto `our-menu` and the file still contains
   * `parseListField(c, "items")` — inside WhyUsSection, a different section
   * entirely. The binding under test is section → renderer, so the section is
   * what has to be resolved first.
   */
  function componentFor(source: string, type: string): string {
    const at = source.indexOf(`case "${type}":`);
    expect(at, `no renderer is dispatched for the "${type}" section`).toBeGreaterThan(-1);
    const match = /<([A-Z]\w+)[\s/]/.exec(source.slice(at, at + 400));
    expect(match?.[1], `could not read the component "${type}" renders`).toBeTruthy();
    return match![1];
  }

  /** That component's own body, so an assertion cannot match a sibling's. */
  function bodyOf(source: string, component: string): string {
    const at = source.indexOf(`function ${component}(`);
    expect(at, `${component} is dispatched but not defined here`).toBeGreaterThan(-1);
    const next = source.indexOf("\nfunction ", at + 1);
    return source.slice(at, next < 0 ? source.length : next);
  }

  const BUILDERS = [
    { registry: HOMEPAGE_SECTION_REGISTRY, path: "features/cms-sections/homepage-section-renderer.tsx" },
    { registry: WEDDING_SECTION_REGISTRY, path: "features/cms-sections/wedding-section-renderer.tsx" },
  ];

  /**
   * Named readers only. `(c, "images")` alone would also be satisfied by
   * `contentString(c, "images")`, which reads the raw JSON as a string — the
   * field would be just as unreadable and the test just as green.
   */
  const readsIn = (body: string, key: string) =>
    ["parseListField", "photoRows"].some(
      (fn) => body.includes(`${fn}(c, "${key}")`) || body.includes(`${fn}(props.section.content, "${key}")`),
    );

  it("is declared on the section whose renderer reads it", () => {
    let checked = 0;

    for (const { registry, path } of BUILDERS) {
      const source = read(path);

      for (const entry of registry) {
        const listFields = (entry.fields ?? []).filter((field) => field.type === "list");
        if (listFields.length === 0) continue;
        const body = bodyOf(source, componentFor(source, entry.type));

        for (const field of listFields) {
          expect(
            readsIn(body, field.key),
            `"${entry.type}" declares a "${field.key}" list field that its own renderer never reads`,
          ).toBe(true);
          checked += 1;
        }
      }
    }

    expect(checked, "no list fields found to check").toBeGreaterThan(0);
  });

  it("exists for every list a renderer reads", () => {
    // The other half of the same mistake: `items` was read by Why Choose Us
    // while the field sat on Menu Strip, so Why Choose Us rendered null forever
    // with no field anywhere an admin could have filled in.
    for (const { registry, path } of BUILDERS) {
      const source = read(path);

      for (const entry of registry) {
        const body = bodyOf(source, componentFor(source, entry.type));
        const keys = [...body.matchAll(/(?:parseListField|photoRows)\(\s*(?:c|props\.section\.content),\s*"(\w+)"/g)];

        for (const [, key] of keys) {
          expect(
            (entry.fields ?? []).some((field) => field.key === key && field.type === "list"),
            `"${entry.type}" reads a "${key}" list that it offers no field for`,
          ).toBe(true);
        }
      }
    }
  });

  it("gives Why Choose Us a way to have cards", () => {
    // The specific regression: this section returns null when `items` is empty,
    // so without the field it could never render again.
    const whyUs = HOMEPAGE_SECTION_REGISTRY.find((entry) => entry.type === "why-us");
    expect(whyUs?.fields?.some((field) => field.key === "items" && field.type === "list")).toBe(
      true,
    );
  });

  it("does not give Menu Strip an editor its renderer ignores", () => {
    const menu = HOMEPAGE_SECTION_REGISTRY.find((entry) => entry.type === "our-menu");
    expect(menu?.fields?.some((field) => field.key === "items")).toBe(false);
  });
});
