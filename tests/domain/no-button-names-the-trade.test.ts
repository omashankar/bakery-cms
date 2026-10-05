import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HOMEPAGE_SECTION_REGISTRY } from "@/constants/section-registry";
import type { SectionFieldDef } from "@/types/homepage-builder";

/**
 * NO BUTTON ON THE HOMEPAGE NAMES THE TRADE.
 *
 * This shop sells cakes today. The CMS behind it is meant to be handed to a
 * florist, a gift shop, a sweet shop — which is why the section headings, the
 * product words and the way-in labels were all emptied or neutralised in turn.
 *
 * The buttons kept slipping through, one at a time, because each one is a
 * separate string in a separate place: a shipped `defaultContent.ctaLabel`, a
 * `placeholder` in the editor, a fallback argument three levels into some JSX.
 * Four rounds of "you missed one" is what this test is for. It reads all three
 * places, so the next one fails here rather than on a florist's homepage.
 *
 * A LABEL A SHOP TYPED ITSELF IS NOT IN SCOPE. This is only about wording the
 * software puts there when nobody has said anything.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";

const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

/**
 * Trades this CMS has already been wrong about, plus the near neighbours.
 *
 * Not a complete list of what a shop can sell — no such list exists. It is the
 * set that has actually appeared in shipped copy here, kept as the cheapest
 * thing that would have caught each round.
 */
const TRADES = [
  "cake", "bakery", "pastry", "dessert", "chocolate", "sweet",
  "flower", "bouquet", "floral",
  "gift", "hamper",
];

const tradesIn = (words: string) =>
  TRADES.filter((trade) => words.toLowerCase().includes(trade));

/** Every `contentString(c, "ctaLabel", "…")` fallback, read without a regex. */
function hardcodedFallbacks(): { at: number; label: string }[] {
  const src = codeOf(read(RENDERER));
  const call = 'contentString(c, "ctaLabel", "';
  const found: { at: number; label: string }[] = [];

  let at = src.indexOf(call);
  while (at > -1) {
    const from = at + call.length;
    found.push({ at, label: src.slice(from, src.indexOf('"', from)) });
    at = src.indexOf(call, from);
  }
  return found;
}

/**
 * Every field in the registry, INCLUDING the columns of a card list.
 *
 * The first draft of this scan read `entry.fields` and stopped. It went
 * green over a placeholder reading "Shop Flowers", because every button a
 * shop actually types into — the promo cards, the tiles, the banner grid —
 * is a column of a list field and not a field of the section.
 */
function everyField(fields: SectionFieldDef[]): SectionFieldDef[] {
  return fields.flatMap((field) => [field, ...everyField(field.itemFields ?? [])]);
}
describe("no button on the homepage names the trade", () => {
  it("has no hardcoded button wording left to get wrong", () => {
    /*
      THIS CASE USED TO DEMAND THE OPPOSITE, and the change is the news.

      The scan looks for `contentString(c, "ctaLabel", "…")` — a button label
      read with a literal behind it — and existed because finding NOTHING
      would make the case below pass on an empty list. It was a floor under
      string surgery.

      Every section that carried one is now deleted: the call to action, the
      store locator, the newsletter and the promo banner. The survivors read
      `contentString(c, "ctaLabel")` with nothing behind it, so a button a
      shop has not named draws no button rather than one this CMS wrote.

      So zero is the answer, and asserting it keeps the scan honest in the
      other direction: if a literal comes back, this fails and the case below
      starts meaning something again.
    */
    const found = hardcodedFallbacks();

    expect(
      found.map((entry) => entry.label),
      "a section hardcodes a button label again — the case below now applies",
    ).toEqual([]);
  });

  it("not in the wording the page falls back to", () => {
    /*
      EMPTY TODAY, and kept for that reason. There is no hardcoded button
      wording left — the case above pins that — so this loop runs over nothing
      and proves nothing right now. It is the ratchet that fires the moment a
      literal comes back carrying a trade word.
    */
    for (const { label } of hardcodedFallbacks()) {
      expect(tradesIn(label), `the fallback ${JSON.stringify(label)} names a trade`).toEqual([]);
    }
  });

  it("not in any button the renderer spells out in full", () => {
    /*
      The promo card's fallback is an argument; the offers card's button is
      just words between tags. Both are the software talking, and only the
      first was ever looked at.
    */
    const src = codeOf(read(RENDERER)).toLowerCase();

    for (const trade of TRADES) {
      expect(
        src.includes("shop " + trade),
        `a button in the renderer says "Shop ${trade}…"`,
      ).toBe(false);
      expect(
        src.includes("order " + trade),
        `a button in the renderer says "Order ${trade}…"`,
      ).toBe(false);
    }
  });

  it("not in a label any section ships with", () => {
    for (const entry of HOMEPAGE_SECTION_REGISTRY) {
      for (const [key, shipped] of Object.entries(entry.defaultContent)) {
        if (typeof shipped !== "string" || !shipped.trim()) continue;
        // A list field ships as JSON, so a card's own button label is inside
        // that string rather than beside it.
        const isLabel = key.toLowerCase().includes("ctalabel") || shipped.includes('"ctaLabel"');
        if (!isLabel) continue;
        expect(
          tradesIn(shipped),
          `${entry.type} ships with ${JSON.stringify(shipped)} on its button`,
        ).toEqual([]);
      }
    }
  });

  it("not in the grey words the editor shows inside an empty box", () => {
    /*
      A placeholder is not content, so it never reaches a customer — but it is
      what an admin copies, and three of the four labels this page had to have
      cleaned up were typed straight out of one.
    */
    for (const entry of HOMEPAGE_SECTION_REGISTRY) {
      for (const field of everyField(entry.fields)) {
        if (!field.key.toLowerCase().includes("ctalabel")) continue;
        const hint = field.placeholder;
        if (!hint) continue;
        expect(
          tradesIn(hint),
          `${entry.type}'s button box suggests ${JSON.stringify(hint)}`,
        ).toEqual([]);
      }
    }
  });

  it("and the way-in pill has no wording of its own to get wrong", () => {
    /*
      The eleven way-in buttons all read "View all", and none of those three
      words is in this repository: the label is the shop's, stored per band,
      and the pill simply does not draw without one. That is why this file
      has nothing to say about them — a blank cannot name a trade.

      Guarded because a "sensible default" here is exactly how the four
      labels above came to be bakery-worded in the first place.
    */
    const file = codeOf(read(RENDERER));
    const from = file.indexOf("function ViewAllLink(");
    expect(from, "ViewAllLink is gone").toBeGreaterThan(-1);
    const next = file.indexOf("\nfunction ", from + 10);
    const link = file.slice(from, next < 0 ? file.length : next);

    expect(link, "the pill draws itself when the shop named nothing").toContain(
      "if (!href || !label) return null;",
    );
    expect(link.includes("label ??"), "the pill invented a label").toBe(false);
    expect(link.includes("label || "), "the pill invented a label").toBe(false);
  });
});
