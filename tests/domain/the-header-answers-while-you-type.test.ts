import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { LandingProduct } from "@/constants/landing-data";
import {
  MIN_SUGGEST_CHARS,
  SUGGESTION_LIMIT,
  suggestProducts,
} from "@/features/products/lib/product-suggestions";
import {
  applyCollectionFilters,
  defaultCollectionFilters,
  collectionPriceCeiling,
} from "@/apps/website/lib/collection-filters";

/**
 * THE HEADER ANSWERS WHILE THE CUSTOMER IS STILL TYPING.
 *
 * The box already worked — type, Enter, results page. What it could not do is
 * answer before the Enter, which is the one thing every shop these customers
 * already use does. The shop asked for it by pointing at one.
 *
 * THE FAILURE THIS FILE EXISTS FOR is not "the dropdown is empty". It is the
 * dropdown offering a product that the page behind Enter then cannot find:
 * the customer sees the thing they came for, taps past it, and lands on "no
 * products found". That is a sale the shop had already made and then lost, and
 * nothing about it looks wrong in a screenshot — both halves work, they just
 * disagree. The last test here is the one that matters.
 *
 * It is a REAL test of the function, not a scan of the file that holds it.
 * Every assertion below runs `suggestProducts` and reads what came back, so
 * deleting the ranking or the cap turns them red rather than leaving them
 * green over a changed implementation.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/**
 * A catalogue built to be ambiguous on purpose.
 *
 * Every one of these matches "choc" through a different field, which is the
 * only way to tell a ranking from an accident: a filter that did no ranking at
 * all would return all six in catalogue order and pass any test that only
 * counted them.
 */
const CATALOGUE: LandingProduct[] = [
  {
    id: "1",
    name: "Vanilla Sponge",
    slug: "vanilla-sponge",
    description: "",
    price: 500,
    image: "https://cdn.example.com/vanilla.jpg",
    category: "Chocolate Cakes",
    rating: 4,
    reviewCount: 2,
  },
  {
    id: "2",
    name: "Dark Chocolate Truffle",
    slug: "dark-chocolate-truffle",
    description: "",
    price: 900,
    image: "https://cdn.example.com/truffle.jpg",
    category: "Birthday",
    rating: 5,
    reviewCount: 9,
  },
  {
    id: "3",
    name: "Chocolate Rush",
    slug: "chocolate-rush",
    description: "",
    price: 700,
    image: "https://cdn.example.com/rush.jpg",
    category: "Birthday",
    rating: 5,
    reviewCount: 4,
  },
  {
    id: "4",
    name: "Butterscotch Jar",
    slug: "butterscotch-jar",
    description: "",
    price: 300,
    image: "https://cdn.example.com/jar.jpg",
    category: "Jars",
    rating: 4,
    reviewCount: 1,
    flavours: ["Chocolate chip"],
  },
  {
    id: "5",
    name: "Chocolate Rush Deluxe",
    slug: "chocolate-rush-deluxe",
    description: "",
    price: 1200,
    image: "https://cdn.example.com/deluxe.jpg",
    category: "Birthday",
    rating: 5,
    reviewCount: 7,
  },
  {
    id: "6",
    name: "Rose Petal Gateau",
    slug: "rose-petal-gateau",
    description: "",
    price: 800,
    image: "https://cdn.example.com/rose.jpg",
    category: "Anniversary",
    rating: 4,
    reviewCount: 3,
    optionLabels: ["Chocolate ganache"],
  },
  /*
    THE ONE THAT SAYS "chocolate" ONLY IN ITS SLUG.

    Its name, its category, its flavours and its options say nothing of the
    sort, so `searchHaystack` — and therefore the results page — cannot find it
    by that word. It is here so the subset test at the bottom of this file has
    something to CATCH: without a product like this, ranking on the slug (or on
    the id, or on anything else the filter does not read) changes no answer for
    any of these fixtures, and a test that cannot tell the two apart passes for
    the wrong reason. Measured: adding a slug rank to the module leaves the
    subset test green without this row and turns it red with it.
  */
  {
    id: "7",
    name: "Midnight Gateau",
    slug: "chocolate-midnight-gateau",
    description: "",
    price: 1500,
    image: "https://cdn.example.com/midnight.jpg",
    category: "Anniversary",
    rating: 5,
    reviewCount: 6,
  },
];

const slugsFor = (query: string, limit = SUGGESTION_LIMIT) =>
  suggestProducts(query, CATALOGUE, limit).map((row) => row.slug);

describe("what the header offers while a customer types", () => {
  it("says nothing at all until there is something to go on", () => {
    /*
      One letter matches a third of any catalogue, so the rows it returns are
      noise wearing the shape of an answer — and every keystroke behind it is
      a request for a list nobody can use.
    */
    expect(MIN_SUGGEST_CHARS).toBe(2);
    expect(suggestProducts("", CATALOGUE)).toEqual([]);
    expect(suggestProducts("c", CATALOGUE)).toEqual([]);
    expect(suggestProducts("  c  ", CATALOGUE)).toEqual([]);
    expect(suggestProducts("ch", CATALOGUE).length).toBeGreaterThan(0);
  });

  it("and an empty catalogue is an empty answer, never everything", () => {
    /*
      THE TRAP IN THE FUNCTION NEXT DOOR. `searchProducts` returns the ENTIRE
      source for a blank query, so a caller that forwarded whatever a stranger
      typed turned `?q=` into a catalogue dump. This one has no such branch and
      this pins that it does not grow one.
    */
    expect(suggestProducts("chocolate", [])).toEqual([]);
    expect(suggestProducts("", [])).toEqual([]);
  });

  it("puts the name that starts with what was typed first", () => {
    /*
      A DROPDOWN'S FIRST ROW IS THE ANSWER, because that is where the eye
      stops. Unranked, this returns "Vanilla Sponge" first — it matches "choc"
      through its CATEGORY, and it happens to be first in the catalogue.
    */
    const order = slugsFor("choc");

    expect(order[0], `the first row is ${order[0]}`).toBe("chocolate-rush");
    expect(order[1]).toBe("chocolate-rush-deluxe");
    // A word of the name starting with it beats the rest of the name...
    expect(order.indexOf("dark-chocolate-truffle")).toBeLessThan(
      order.indexOf("vanilla-sponge"),
    );
    // ...and the category beats matching only through a flavour or an option.
    expect(order.indexOf("vanilla-sponge")).toBeLessThan(order.indexOf("butterscotch-jar"));
    expect(order.indexOf("vanilla-sponge")).toBeLessThan(order.indexOf("rose-petal-gateau"));
  });

  it("and reads a word inside a name, not just the letters", () => {
    /*
      "velvet" has to find "Red Velvet", which is how people search — by the
      distinguishing word rather than the first one. But "elvet" is a typo, not
      a word, and ranking it as though the customer had typed the start of one
      would put a coincidence above a real match.
    */
    expect(slugsFor("chocolate")[0]).toBe("chocolate-rush");

    /*
      The pair is built so that NOTHING ELSE can decide it: both names are
      fourteen characters, so the length tie-break is neutral, and "Brushwood"
      sorts before "Chocolate" alphabetically — so if the word-start rank were
      dropped, this order would invert rather than merely wobble.
    */
    const pair: LandingProduct[] = [
      { ...CATALOGUE[0]!, id: "b", slug: "brushwood-cake", name: "Brushwood Cake" },
      { ...CATALOGUE[0]!, id: "r", slug: "rush-hour-cake", name: "Chocolate Rush" },
    ];

    expect(
      suggestProducts("rush", pair).map((row) => row.slug),
      "a fragment buried inside a word outranks the start of one",
    ).toEqual(["rush-hour-cake", "brushwood-cake"]);
  });

  it("and never offers more rows than fit under the box", () => {
    expect(SUGGESTION_LIMIT).toBe(6);
    expect(suggestProducts("choc", CATALOGUE, 2)).toHaveLength(2);
    expect(suggestProducts("choc", CATALOGUE, 0)).toHaveLength(0);

    const many = Array.from({ length: 40 }, (_, index) => ({
      ...CATALOGUE[2]!,
      id: `x${index}`,
      slug: `chocolate-${index}`,
      name: `Chocolate ${index}`,
    }));
    expect(suggestProducts("choc", many)).toHaveLength(SUGGESTION_LIMIT);
  });

  it("and gives the same answer twice, whatever order the catalogue arrived in", () => {
    /*
      Two products at the same rank came back in the order the database
      answered in, so the row under the customer's finger could move between
      one keystroke and the next — and the rows are links, so a moving list is
      a customer opening a product they did not choose.
    */
    const forwards = slugsFor("choc");
    const backwards = suggestProducts("choc", [...CATALOGUE].reverse()).map((r) => r.slug);

    expect(backwards, "the order depends on the catalogue's own order").toEqual(forwards);
  });

  it("and carries the four things a row draws, and nothing else", () => {
    const [row] = suggestProducts("chocolate rush", CATALOGUE);
    expect(row).toBeTruthy();
    expect(Object.keys(row!).sort()).toEqual(["category", "image", "name", "slug"]);
  });

  it("and refuses an inlined image without substituting a different one", () => {
    /*
      THIS SHOP HAS ONE. `ring-ceremony-special-cake` stores 114,243 characters
      of base64 where a URL belongs. A dropdown reading it would put 114 KB
      into a response whose other five rows come to about two, so it is refused
      and the row draws the product's initial instead.

      THE SECOND HALF IS THE ONE THAT WAS NEARLY SHIPPED WRONG. The first
      version fell through to `images[1]`, on the assumption that the array
      holds sizes of one photograph. It does not — it is the shop's gallery,
      and the other entries are DIFFERENT PICTURES. On that very product
      images[1] and images[2] are stock photographs of a woman with shopping
      bags; downloading them is what settled it. So the fallback put a stranger
      in a headscarf under the words "Ring Ceremony Special Cake".

      A missing thumbnail is a gap. A wrong one is the shop telling a customer
      that this is the thing they are buying.
    */
    const inline = "data:image/jpeg;base64," + "A".repeat(2000);
    const ringCake = (images: string[]) => ({
      ...CATALOGUE[0]!,
      slug: "ring-cake",
      name: "Ring Cake",
      image: images[0]!,
      images,
    });

    expect(
      suggestProducts("ring", [ringCake([inline, "https://cdn.example.com/other-thing.webp"])])[0]!
        .image,
      "a different photograph was substituted for the one that would not fit",
    ).toBe("");

    expect(
      suggestProducts("ring", [ringCake([inline])])[0]!.image,
      "a product with only an inline image ships it",
    ).toBe("");

    // …and a hosted first image is used exactly as stored.
    expect(
      suggestProducts("ring", [ringCake(["https://cdn.example.com/ring.webp", inline])])[0]!.image,
    ).toBe("https://cdn.example.com/ring.webp");
  });

  it("and NEVER offers a product the results page cannot find", () => {
    /*
      THE ONE THAT MATTERS.

      Enter goes to /store/collections?q=…, which filters through
      `applyCollectionFilters`. If this ranks on a field that filter does not
      read, the dropdown shows a product and the page it leads to says "no
      products found" — the shop showing a customer the thing they came for
      and then losing it.

      Checked as a SUBSET over every query a customer might plausibly type,
      including the two that match only through a flavour and an option label,
      which is exactly where the two predicates would drift apart first.
    */
    const ceiling = collectionPriceCeiling(CATALOGUE);

    for (const query of [
      "ch",
      "choc",
      "chocolate",
      "rush",
      "truffle",
      "birthday",
      "jar",
      "ganache",
      "chocolate chip",
      "rose",
      "vanilla",
    ]) {
      const suggested = suggestProducts(query, CATALOGUE).map((row) => row.slug);
      const findable = applyCollectionFilters(CATALOGUE, {
        ...defaultCollectionFilters(ceiling),
        search: query,
      }).map((cake) => cake.slug);

      const orphans = suggested.filter((slug) => !findable.includes(slug));
      expect(
        orphans,
        `"${query}" suggests ${orphans.join(", ")}, which the results page does not show`,
      ).toEqual([]);
    }
  });

  it("and the two predicates are one function, not two copies of a list", () => {
    /*
      The subset above holds today. This is what keeps it holding: the
      collections filter used to write the six field names out again inline,
      under a comment promising they matched — a promise a person has to keep
      by hand, and one that had already been broken once over `optionLabels`.
    */
    const filters = read("apps/website/lib/collection-filters.ts");

    expect(filters, "the filter no longer shares the haystack").toContain(
      "searchHaystack(cake).includes(query)",
    );
    expect(
      filters.includes("...(cake.optionLabels ?? []),"),
      "the haystack has been copied back into the filter",
    ).toBe(false);
  });
});

describe("the endpoint that answers the box", () => {
  const CONTROLLER = "features/products/server/product-suggest.controller.ts";

  it("refuses a blank query before it reads anything", () => {
    /*
      ORDER IS THE POINT, not the presence of the check. Below the minimum
      this must return before `getStorefrontProductCards()`, or a stranger
      holding down a key costs the shop a full catalogue read per keystroke to
      be told nothing.
    */
    const source = read(CONTROLLER);
    const refusal = source.indexOf("query.length < MIN_SUGGEST_CHARS");
    const readsProducts = source.indexOf("await getStorefrontProductCards()");

    expect(refusal, "the blank-query guard is gone").toBeGreaterThan(-1);
    expect(readsProducts, "the endpoint reads no products at all").toBeGreaterThan(-1);
    expect(refusal, "the catalogue is read before the query is checked").toBeLessThan(
      readsProducts,
    );
  });

  it("and throttles, and only when there is a caller to throttle", () => {
    /*
      `ctx.ip` is "" unless TRUST_PROXY_HEADERS=true, and an empty string is a
      CONSTANT — one bucket shared by every visitor at once. The enquiry form
      learned that painfully: five submissions a minute across the whole shop,
      so the sixth customer on a Saturday got a 429.
    */
    const source = read(CONTROLLER);

    expect(source, "a public read with no limit at all").toContain("rateLimit(");
    expect(source, "the limit is keyed on a constant when there is no trusted IP").toContain(
      "if (ctx.ip) rateLimit(",
    );
  });

  it("and is reachable at a route that exports nothing else", () => {
    // A GET-only public endpoint. Anything else here would be a write on a
    // path that takes an untrusted query parameter.
    const route = read("app/api/products/suggest/route.ts");

    expect(route).toContain("suggestProductsController as GET");
    expect(route.includes("POST"), "the suggestions route accepts writes").toBe(false);
  });
});
