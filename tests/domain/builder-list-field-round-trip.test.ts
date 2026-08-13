import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  HOMEPAGE_SECTION_REGISTRY,
  parseListField,
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

  it("is declared on the section whose renderer reads it", () => {
    const homepage = read("features/cms-sections/homepage-section-renderer.tsx");
    const wedding = read("features/cms-sections/wedding-section-renderer.tsx");

    const declarations = [
      ...HOMEPAGE_SECTION_REGISTRY.flatMap((entry) =>
        (entry.fields ?? [])
          .filter((field) => field.type === "list")
          .map((field) => ({ section: entry.type, key: field.key, source: homepage })),
      ),
      ...WEDDING_SECTION_REGISTRY.flatMap((entry) =>
        (entry.fields ?? [])
          .filter((field) => field.type === "list")
          .map((field) => ({ section: entry.type, key: field.key, source: wedding })),
      ),
    ];

    expect(declarations.length, "no list fields found to check").toBeGreaterThan(0);

    for (const { section, key, source } of declarations) {
      expect(
        source.includes(`parseListField(c, "${key}")`) ||
          source.includes(`parseListField(props.section.content, "${key}")`),
        `"${section}" declares a "${key}" list field that no renderer reads`,
      ).toBe(true);
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
