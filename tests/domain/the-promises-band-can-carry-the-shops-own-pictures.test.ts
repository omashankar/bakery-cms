import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HOMEPAGE_SECTION_REGISTRY } from "@/constants/section-registry";

/**
 * THE BAND OF PROMISES — a picture, a bold line, a quieter line, four across.
 *
 * IT IS NOT A NEW SECTION, and finding that out was most of the work. `why-us`
 * has drawn exactly this band all along: a list the shop fills in, an icon per
 * row, empty by default, nothing drawn when empty. It is on this shop's page
 * with four points the shop wrote itself. So it gained two things rather than
 * being written again:
 *
 *   a PICTURE per row, because the layout the shop held up uses small
 *   illustrations and no icon set will ever match a shop's own artwork;
 *
 *   a SHAPE, because the layout puts the four points inside one tinted panel
 *   with the picture beside the words, and this band drew four bordered cards
 *   with the icon above them.
 *
 * Both ship blank, so the band already published keeps what it had.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";

const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const entry = HOMEPAGE_SECTION_REGISTRY.find((s) => s.type === "why-us");

/** The band's own body, so no guard can be met by another section. */
function band(): string {
  const src = codeOf(read(RENDERER));
  const at = src.indexOf("function WhyUsSection(");
  expect(at, "WhyUsSection is gone").toBeGreaterThan(-1);
  const next = src.indexOf("\nfunction ", at + 10);
  return src.slice(at, next < 0 ? src.length : next);
}

const tileFields = () =>
  entry!.fields.find((f) => f.key === "items")?.itemFields ?? [];

describe("the promises band carries the shop's own pictures", () => {
  it("takes a picture per point, and says what size to export", () => {
    const picture = tileFields().find((f) => f.key === "image");

    expect(picture, "there is no way to upload a picture").toBeTruthy();
    expect(picture!.isImage, "the picture field is not a picture field").toBe(true);
    expect(picture!.hint ?? "", "nothing says what size to export").toContain("144 x 144");
  });

  it("and offers no icon at all any more", () => {
    /*
      THE SHOP ASKED FOR THEM GONE, and the reasoning is worth keeping: the
      layout this band is drawn from uses small illustrations, and four line
      icons are not a smaller version of that. They are a different thing that
      happens to fit the box.

      It costs something, and the cost is not hidden: the four points already
      published on this page were all icon-only, so each draws no circle until
      a picture is uploaded for it.
    */
    expect(
      tileFields().some((f) => f.key === "icon"),
      "the icon choice is back",
    ).toBe(false);

    const body = band();
    expect(body.includes("whyIcons"), "the icon map is back").toBe(false);
    expect(body.includes("<Icon "), "an icon is still drawn").toBe(false);
  });

  it("and draws no circle at all for a point with no picture", () => {
    /*
      NOT AN EMPTY DISC. A blank circle beside two lines of text reads as a
      picture that failed to load — a worse thing to publish than two lines on
      their own, and on this page it would have read that way four times over
      until the shop uploaded anything.
    */
    const body = band();
    const at = body.indexOf("const badge = picture ?");
    expect(at, "the badge is gone").toBeGreaterThan(-1);

    expect(
      body.slice(at, at + 600),
      "an empty circle is drawn where there is no picture",
    ).toContain(") : null;");
  });

  it("and never drops a point for having no picture", () => {
    /*
      `photoRows` exists and keeps only rows that HAVE a picture. Used here it
      would silently delete every icon-only point — including all four on this
      shop's own page, none of which has an uploaded picture.
    */
    const body = band();

    expect(body, "the rows are filtered by picture").toContain(
      'renderableRows(parseListField(c, "items"))',
    );
    expect(body.includes("photoRows"), "icon-only points are being dropped").toBe(false);
  });

  it("offers two shapes, and ships the one it already had", () => {
    const shape = entry!.fields.find((f) => f.key === "layout");

    expect(shape, "there is no way to choose the shape").toBeTruthy();
    expect(shape!.options?.map((o) => o.value)).toEqual(["", "strip"]);
    expect(entry!.defaultContent.layout, "the new shape is now the default").toBe("");
  });

  it("and draws both of them", () => {
    /*
      A SETTING THE RENDERER NEVER READS is this repo's most-recorded defect:
      the editor draws the box, the value is stored, the page ignores it. So
      the read is pinned inside this band's own body, not anywhere in the file.
    */
    const body = band();

    expect(body, "the shape is never read").toContain(
      'contentString(c, "layout").trim() === "strip"',
    );
    /*
      The strip is one tinted panel; the cards are four bordered boxes.

      `band-sand` and not `cream-100`, measured: the tint being copied is a
      warm butter the eye reads as a panel, and `--cream-100` is
      rgb(250,248,244) — near enough to white that the band did not read as a
      band at all.
    */
    expect(body, "the strip has no panel of its own").toContain("bg-band-sand");
    expect(body.includes("bg-cream-100"), "the panel is near-white again").toBe(false);
    expect(body, "the cards lost their border").toContain(
      '"rounded-xl border border-border bg-card p-5"',
    );
    // And the picture sits BESIDE the words in the strip, above them in cards.
    expect(body, "the strip does not lay its points sideways").toContain(
      '"flex items-center gap-3 sm:gap-4"',
    );
  });

  it("and the strip never splits where the split makes a point worse", () => {
    /*
      MEASURED IN A BROWSER AT TEN WIDTHS, both shapes, pictures on.

      The strip puts the picture BESIDE the words, so every split takes 84px
      off the words before it halves what is left. Splitting on the same
      breakpoints as the cards — `sm` then `lg` — left the words 148px wide at
      640 and 108px at 1024, against the 194px a 390px phone gives them. Two
      of the four points wrapped to a third line at 1024 and the row went
      ragged, 68px beside 87px.

      Waiting for `md` and then `xl` holds the words at 194px everywhere
      except 1280, where four across leaves 172. The cards are untouched: they
      stack the words UNDER the picture, so a narrow column costs them far
      less, and they are what is already published.
    */
    /*
      Each shape's own class string, picked out by the tint that tells them
      apart — the comments are stripped from `band()`, so the `?` and `:` of
      the branch are not reliable anchors.
    */
    const strings = [...band().matchAll(/"grid gap-\d[^"]*"/g)].map((m) => m[0]);
    const panel = strings.find((s) => s.includes("bg-band-sand"));
    const cards = strings.find((s) => !s.includes("bg-band-sand"));

    expect(panel, "the strip's own classes are gone").toBeTruthy();
    expect(cards, "the cards' own classes are gone").toBeTruthy();

    expect(panel!, "the strip splits on a small tablet again").not.toContain("sm:grid-cols-2");
    expect(panel!, "the strip never reaches two across").toContain("md:grid-cols-2");
    expect(panel!, "the strip goes four across too early").not.toContain("lg:grid-cols-4");
    expect(panel!, "the strip never reaches four across").toContain("xl:grid-cols-4");

    // And the cards keep the steps they were published with.
    expect(cards!, "the cards' own steps moved").toContain("sm:grid-cols-2");
    expect(cards!, "the cards' own steps moved").toContain("lg:grid-cols-4");
  });

  it("and no section makes the shop scroll past a list to reach its heading", () => {
    /*
      THE SHOP FOUND THIS ONE: "iski title setting bottom me he use upar dalo".

      This band's editor opened with the Cards list — four rows, each with a
      picture box, a title and a line under it — and the band's OWN heading
      boxes sat underneath all of it. The more points a shop adds, the further
      its own title moves down the screen.

      Checked across the whole registry rather than on this band alone: three
      sections had it (`why-us`, `gallery`, `instagram`), and the next section
      with a list would have had it too.
    */
    const buried: string[] = [];
    for (const section of HOMEPAGE_SECTION_REGISTRY) {
      const keys = section.fields.map((f) => f.key);
      const heading = keys.findIndex((k) => k === "overline" || k === "title");
      const list = section.fields.findIndex((f) => f.type === "list");
      if (heading < 0 || list < 0) continue;
      if (list < heading) buried.push(`${section.type}: ${keys.join(", ")}`);
    }

    expect(buried, `${buried.length} sections bury their heading under a list`).toEqual([]);
  });

  it("suggests no wording of its own, anywhere", () => {
    /*
      THE PLACEHOLDER WAS THE LEAK. This band's Title box suggested "Premium
      Ingredients" — food, and a claim — and three of the four labels that had
      to be cleaned off this page were typed straight out of a placeholder.

      The reference layout's own points are "Delivery in 700+ Cities" and
      "20 Million People Trust Us". Nothing in this CMS can make either true,
      and there is no field anywhere that could.
    */
    for (const field of [...tileFields(), ...entry!.fields]) {
      expect(field.placeholder ?? "", `${field.key} suggests wording`).toBe("");
    }
    for (const [key, value] of Object.entries(entry!.defaultContent)) {
      if (key === "title") continue; // the band's own name, not a claim
      expect(value, `${key} ships with words in it`).toBe("");
    }
  });
});
