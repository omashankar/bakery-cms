import type { LandingProduct } from "@/constants/landing-data";

import { searchHaystack } from "./product-catalog";

/**
 * WHAT A TYPED SEARCH MATCHES — one predicate for the header's dropdown and
 * the results page it lands on, so a row the dropdown offers is always on the
 * page underneath it.
 *
 * It was `haystack.includes(wholeQuery)`, which a customer meets as:
 *
 * - "truffle chocolate" and "eggless chocolate" found nothing — the words were
 *   all there, in another order or with other words between them;
 * - "redvelvet", "blackforest" found nothing — typed without the space;
 * - "choclate" found nothing — one letter out, on a phone keyboard;
 * - "chocolate cake" put a baby-shower cake first, because the phrase was in
 *   its description and the chocolate cakes' names say "Chocolate … Cake".
 *
 * So the query is split into words and EVERY word must appear (in any order,
 * with or without spaces between), the product's own name outranks its
 * description, and only when nothing at all matches exactly does a near spelling
 * count — a typo should find the cake, but "cream" must not start finding
 * "dream" while there are creams to show.
 */

/** Lower case, accents off Latin letters, anything that is not a letter or digit a space. */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    // Latin combining accents only — the marks of Devanagari are letters' own.
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function searchTokens(query: string): string[] {
  const normalized = normalizeSearchText(query);
  return normalized ? normalized.split(" ") : [];
}

interface Prepared {
  name: string;
  nameCompact: string;
  nameWords: string[];
  category: string;
  all: string;
  allCompact: string;
  allWords: string[];
}

function prepare(product: LandingProduct): Prepared {
  const name = normalizeSearchText(product.name ?? "");
  const category = normalizeSearchText(product.category ?? "");
  const all = normalizeSearchText(searchHaystack(product));
  return {
    name,
    nameCompact: name.replace(/ /g, ""),
    nameWords: name.split(" ").filter(Boolean),
    category,
    all,
    allCompact: all.replace(/ /g, ""),
    allWords: [...new Set(all.split(" ").filter(Boolean))],
  };
}

const inText = (text: string, compact: string, token: string) =>
  text.includes(token) || compact.includes(token);

/** Every token found, and joined tokens count too ("red velvet" ↔ "redvelvet"). */
function allIn(text: string, compact: string, tokens: string[]): boolean {
  if (tokens.every((t) => inText(text, compact, t))) return true;
  return tokens.length > 1 && compact.includes(tokens.join(""));
}

/**
 * The exact tier, smaller is better; null when not every word is there.
 *  0 the name starts with what was typed
 *  1 every word starts a word of the name
 *  2 every word is in the name
 *  3 every word is in the name or the category
 *  4 every word is somewhere on the product
 */
function exactRank(p: Prepared, tokens: string[], phrase: string): number | null {
  if (p.name.startsWith(phrase) || p.nameCompact.startsWith(phrase.replace(/ /g, ""))) return 0;
  if (tokens.every((t) => p.nameWords.some((w) => w.startsWith(t)))) return 1;
  if (allIn(p.name, p.nameCompact, tokens)) return 2;
  const nameAndCategory = `${p.name} ${p.category}`;
  if (allIn(nameAndCategory, nameAndCategory.replace(/ /g, ""), tokens)) return 3;
  if (allIn(p.all, p.allCompact, tokens)) return 4;
  return null;
}

/** Optimal-string-alignment distance, giving up past `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    rows.push([i]);
    for (let j = 1; j <= b.length; j++) rows[i].push(i === 0 ? j : 0);
  }
  for (let i = 1; i <= a.length; i++) {
    let best = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, rows[i - 2][j - 2] + 1);
      }
      rows[i][j] = d;
      best = Math.min(best, d);
    }
    if (best > max) return max + 1;
  }
  return rows[a.length][b.length];
}

/** How far a typed word may stray: none under four letters, one to six, two from seven. */
function allowedTypos(token: string): number {
  if (token.length < 4) return 0;
  return token.length < 7 ? 1 : 2;
}

/**
 * The nearest word on the product to a typed one — whole, or its first few
 * letters, so "choclat" (still being typed) finds "chocolate".
 */
function nearest(token: string, words: string[]): number {
  const max = allowedTypos(token);
  let best = max + 1;
  for (const word of words) {
    if (word.includes(token)) return 0;
    if (max === 0) continue;
    best = Math.min(best, distance(token, word, max));
    for (let k = token.length - 1; k <= token.length + 1; k++) {
      if (k > 0 && k < word.length) best = Math.min(best, distance(token, word.slice(0, k), max));
    }
    if (best === 0) return 0;
  }
  return best;
}

/** The near-spelling tier: every word within its allowance; the total distance ranks it. */
function fuzzyRank(p: Prepared, tokens: string[]): number | null {
  let total = 0;
  for (const token of tokens) {
    const d = nearest(token, p.allWords);
    if (d > allowedTypos(token)) return null;
    // A near match in the name beats the same one in a description.
    total += d + (nearest(token, p.nameWords) <= allowedTypos(token) ? 0 : 1);
  }
  return 5 + total;
}

export interface SearchHit<T> {
  product: T;
  rank: number;
}

/**
 * The products a query finds, best first; `fuzzy` says the spelling was
 * forgiven because nothing matched as typed.
 *
 * Ties go to the shorter name (the closer match to what was typed), then the
 * name, then the slug — a total order, so the row under a customer's finger
 * does not move between two identical keystrokes.
 */
export function searchCatalog<T extends LandingProduct>(
  query: string,
  products: readonly T[],
): { hits: SearchHit<T>[]; fuzzy: boolean } {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return { hits: [], fuzzy: false };
  const phrase = tokens.join(" ");

  const prepared = products
    .filter((product) => product?.slug && product.name)
    .map((product) => ({ product, p: prepare(product) }));

  let fuzzy = false;
  let hits: SearchHit<T>[] = [];
  for (const { product, p } of prepared) {
    const rank = exactRank(p, tokens, phrase);
    if (rank !== null) hits.push({ product, rank });
  }
  if (hits.length === 0) {
    fuzzy = true;
    for (const { product, p } of prepared) {
      const rank = fuzzyRank(p, tokens);
      if (rank !== null) hits.push({ product, rank });
    }
  }

  hits = hits.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.product.name.length - b.product.name.length ||
      a.product.name.localeCompare(b.product.name) ||
      a.product.slug.localeCompare(b.product.slug),
  );
  return { hits, fuzzy };
}
