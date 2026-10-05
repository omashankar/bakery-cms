import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseListField, rowFlag } from "@/constants/section-registry";

/**
 * A TICKBOX INSIDE A LIST ROW.
 *
 * `parseListField` coerces every value in a row to a string, because a row is
 * admin-typed and the rest of its fields genuinely are strings. So a tickbox
 * that was OFF came back as the string "false" — five characters long, and
 * therefore truthy.
 *
 * The one place this bites today is the promo band's `wide` card: a card
 * explicitly marked NOT wide spanned two columns anyway, and the only way to
 * narrow it again was to clear the field rather than untick it. There was no
 * tickbox to untick either — a boolean column had no branch in the list
 * editor, so it rendered as a text box and an admin had to type the word.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const EDITOR = "apps/admin/builders/shared/section-editor-panel.tsx";
const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";

const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("reading a tickbox back out of a list row", () => {
  it("is off for every spelling of off a person would type", () => {
    // The string "false" is the one that matters — it is what the tickbox
    // itself now writes — but a row hand-edited before this existed could
    // carry any of these.
    for (const value of ["false", "False", "FALSE", "0", "no", "off", "", "   "]) {
      expect(rowFlag(value), `"${value}" read as on`).toBe(false);
    }
    expect(rowFlag(undefined), "a missing value read as on").toBe(false);
  });

  it("is on for what a person would type meaning on", () => {
    // Rows saved before the tickbox existed carry hand-typed words, and they
    // have to keep meaning what they said.
    for (const value of ["true", "True", "yes", "on", "1"]) {
      expect(rowFlag(value), `"${value}" read as off`).toBe(true);
    }
  });

  it("survives the round trip through a stored list", () => {
    /**
     * The whole bug in one assertion: a real boolean goes into the JSON, comes
     * back out as a string, and the naive truthiness check says both cards are
     * wide. `rowFlag` is what makes the second one narrow.
     */
    const stored = JSON.stringify([
      { title: "wide one", wide: true },
      { title: "narrow one", wide: false },
    ]);
    const rows = parseListField({ cards: stored }, "cards");

    expect(rows[0].wide, "the round trip stopped coercing to a string").toBe("true");
    expect(rows[1].wide).toBe("false");
    // Truthiness alone — the bug.
    expect(Boolean(rows[1].wide), "this is the bug this file exists for").toBe(true);
    // And the reader.
    expect(rowFlag(rows[0].wide)).toBe(true);
    expect(rowFlag(rows[1].wide)).toBe(false);
  });
});

describe("the two ends of that tickbox", () => {
  it("the band with a wide row reads its flag through rowFlag, not the string", () => {
    /*
      THE PROMO COLLAGE WAS THIS CASE'S SUBJECT and was deleted with eight
      others. The property is not about that band: a stored tickbox
      round-trips as the STRING "false", which is truthy, so any row that
      reads one directly is the bug. The banner grid has the surviving wide
      row, and the pattern below still names the old spelling so the bug
      cannot come back under its old name either.
    */
    const renderer = codeOf(read(RENDERER));

    expect(renderer, "a wide row reads a string as a flag again").not.toMatch(
      /[^w](?:card|banner)\.wide \?/,
    );
    expect(renderer, "the wide row no longer goes through rowFlag").toContain(
      "rowFlag(banner.wide)",
    );
  });

  it("the builder draws a boolean column as a control, not a text box", () => {
    /**
     * Without this branch a boolean column falls through to the Input at the
     * end of the chain, and the admin is asked to type a word. Scoped to the
     * list-row renderer, because the panel has a separate top-level boolean
     * field that has always had a switch.
     */
    const editor = codeOf(read(EDITOR));
    const rows = editor.slice(
      editor.indexOf("{columns.map((column) =>"),
      editor.indexOf("function SlidesField("),
    );

    expect(rows, "the list-row slice is empty").not.toBe("");
    expect(rows, "a boolean column still falls through to a text box").toContain(
      'column.type === "boolean"',
    );
    expect(rows, "the control does not write a value rowFlag can read").toContain(
      'checked ? "true" : "false"',
    );
    expect(rows, "the control does not show the stored state").toContain(
      "checked={rowFlag(row[column.key])}",
    );
  });
});
