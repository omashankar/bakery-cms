import { Package, type LucideIcon } from "lucide-react";
import type { BusinessType, LabelOverrides } from "@/types/settings";

/**
 * The product-noun wording a shop shows its customers.
 *
 * This was a `Record<BusinessType, BusinessLabels>` — ten trades, each with its
 * own nouns, keyed off a closed enum in Settings. The enum decided nothing else
 * (it gated only the Wedding Builder), it had to be extended every time a shop
 * turned out to be a trade nobody had listed, and a shop selling cakes AND
 * chargers AND flowers had no honest value to pick.
 *
 * The type is back, on one condition: it picks DEFAULTS and restricts nothing.
 * So there are three layers here, not one. `DEFAULT_LABELS` is the neutral
 * floor — a default that says "Cake" is the same bug in one row instead of
 * ten, so the floor never does. `BUSINESS_TYPE_LABELS` sits on it as a
 * starting point per trade. And `labelOverrides` — what the shop actually
 * typed — wins over both, which is what keeps a shop selling cakes AND
 * chargers AND flowers able to say so.
 *
 * Scope is still intentionally small: public headings plus the singular/plural
 * product noun. Routes, folders, components and database collections are never
 * renamed from here.
 */
export interface BusinessLabels {
  /** Heading on the storefront collections / shop-all page (no category selected). */
  collectionsTitle: string;
  /** Sub-heading under the collections title. */
  collectionsSubtitle: string;
  /** Singular noun for one catalog item. */
  productWord: string;
  /** Plural noun for catalog items. */
  productWordPlural: string;
  /** Title over the whole product description block. */
  descriptionHeading: string;
  /**
   * The catalog icon in the admin sidebar and empty states.
   *
   * ONE neutral icon for every shop. It was a per-trade Lucide component, which
   * cannot cross an API boundary and so could never be part of what a shop
   * configures — and there is no single trade icon for a shop selling cakes,
   * cold drinks and chargers anyway.
   */
  productIcon: LucideIcon;
}

export const DEFAULT_LABELS: BusinessLabels = {
  collectionsTitle: "Our Collections",
  collectionsSubtitle: "Browse everything we sell by category.",
  productWord: "Product",
  productWordPlural: "Products",
  descriptionHeading: "Product Description",
  productIcon: Package,
};

/**
 * The wording each business type STARTS a shop on.
 *
 * These lived in `settings-utils.ts` as migration input only, kept so that
 * deleting the enum would not change what a running shop called its own
 * products on the day the change deployed. They are live presets again — the
 * business type is back — and they belong here, with the rest of the wording.
 *
 * A preset is a STARTING POINT, never an answer. Every one of these is
 * overridden the moment a shop types its own, and `"other"` matches
 * `DEFAULT_LABELS`, so a shop that has not chosen is where it always was.
 *
 * Adding a trade here is adding wording. It is not, and must never become, a
 * place where a trade gets different behaviour.
 */
export const BUSINESS_TYPE_LABELS: Record<BusinessType, LabelOverrides> = {
  bakery: {
    collectionsTitle: "Our Collections",
    collectionsSubtitle: "Browse premium cakes by category, flavour, and occasion.",
    productWord: "Cake",
    productWordPlural: "Cakes",
  },
  "sweet-shop": {
    collectionsTitle: "Our Sweets",
    collectionsSubtitle: "Browse our sweets and confections by category and occasion.",
    productWord: "Sweet",
    productWordPlural: "Sweets",
  },
  "flower-shop": {
    collectionsTitle: "Our Flowers",
    collectionsSubtitle: "Browse fresh flowers and arrangements by category and occasion.",
    productWord: "Bouquet",
    productWordPlural: "Flowers",
  },
  restaurant: {
    collectionsTitle: "Our Menu",
    collectionsSubtitle: "Browse our menu by category.",
    productWord: "Dish",
    productWordPlural: "Dishes",
  },
  "gift-shop": {
    collectionsTitle: "Our Gifts",
    collectionsSubtitle: "Browse gifts by category and occasion.",
    productWord: "Gift",
    productWordPlural: "Gifts",
  },
  grocery: {
    collectionsTitle: "Our Products",
    collectionsSubtitle: "Browse groceries and essentials by category.",
    productWord: "Product",
    productWordPlural: "Products",
  },
  fashion: {
    collectionsTitle: "Our Collection",
    collectionsSubtitle: "Browse the latest styles by category.",
    productWord: "Product",
    productWordPlural: "Products",
  },
  electronics: {
    collectionsTitle: "Our Products",
    collectionsSubtitle: "Browse electronics and gadgets by category.",
    productWord: "Product",
    productWordPlural: "Products",
  },
  pharmacy: {
    collectionsTitle: "Our Products",
    collectionsSubtitle: "Browse health and wellness products by category.",
    productWord: "Product",
    productWordPlural: "Products",
  },
  /**
   * EMPTY, and it has to be.
   *
   * "Something else" is a shop that has not named a trade, which is exactly the
   * neutral case — so it contributes no preset and `DEFAULT_LABELS` stands.
   *
   * It held its own four strings while it was migration input, and they were
   * close to the defaults but not equal: "Our Products" against "Our
   * Collections", "Browse our products by category." against "Browse everything
   * we sell by category.". `"other"` is the default for every shop that has
   * never touched this field, so carrying those across would have renamed the
   * collections heading of every existing shop on the day the type came back —
   * the same harm, in reverse, that deleting the enum was careful to avoid.
   */
  other: {},
};

/** The wording in force before a shop has said anything. */
export function getBusinessLabels(): BusinessLabels {
  return DEFAULT_LABELS;
}

/** The STRING labels only — no `productIcon`, which cannot cross an API boundary. */
export interface ResolvedLabels {
  collectionsTitle: string;
  collectionsSubtitle: string;
  productWord: string;
  productWordPlural: string;
  descriptionHeading: string;
}

/**
 * The shop's own words over the defaults.
 *
 * The ONE place a blank override means "use the default" rather than "use an
 * empty label" — an admin clearing the box gets the fallback back, not a
 * nameless button.
 *
 * Lives here rather than behind a `.server` boundary because it is pure and
 * both sides need it: the server ships the result as `settings.labels`, and
 * `useBusinessLabels` resolves the same way in the browser.
 */
export function resolveLabels(
  overrides: LabelOverrides = {},
  /**
   * Optional, and the two-layer fallback is the whole point.
   *
   * What the shop TYPED wins over what its trade suggests, which wins over the
   * neutral default. Optional because a caller that has no settings in reach
   * still gets sensible wording rather than a required argument it would have
   * to invent.
   */
  businessType?: BusinessType,
): ResolvedLabels {
  const preset = businessType ? BUSINESS_TYPE_LABELS[businessType] : undefined;
  const base: BusinessLabels = preset ? { ...DEFAULT_LABELS, ...preset } : DEFAULT_LABELS;
  const productWord = overrides.productWord?.trim() || base.productWord;
  return {
    collectionsTitle: overrides.collectionsTitle?.trim() || base.collectionsTitle,
    collectionsSubtitle: overrides.collectionsSubtitle?.trim() || base.collectionsSubtitle,
    productWord,
    productWordPlural: overrides.productWordPlural?.trim() || base.productWordPlural,
    descriptionHeading: overrides.descriptionHeading?.trim() || base.descriptionHeading,
  };
}

/**
 * A guess at the plural of a word the shop just typed.
 *
 * ONLY ever a starting value for an editable box, never the stored answer.
 * `productWordPlural` is a separate field precisely because the plural is not
 * always the singular plus a letter, and these rules are English ones: a shop
 * selling Mithai or Namkeen gets a wrong guess and must be able to correct it.
 * That is why nothing calls this at render time.
 *
 * The four boxes were blank and independent, so a shop had to fill both and
 * could fill them wrong — this one filled BOTH with "products" and every plural
 * surface then read "Add products".
 *
 * -ves is deliberately absent. Loaf/Loaves is right and Chef/Chefs, Roof/Roofs
 * and Belief/Beliefs are not, and a shop's goods are far likelier to be the
 * second kind.
 */
export function guessPlural(word: string): string {
  const trimmed = word.trim();
  if (!trimmed) return "";
  // Box → Boxes, Dish → Dishes, Watch → Watches, Dress → Dresses.
  if (/(s|x|z|ch|sh)$/i.test(trimmed)) return `${trimmed}es`;
  // Candy → Candies, but Toy → Toys: only a CONSONANT before the y.
  if (/[^aeiou]y$/i.test(trimmed)) return `${trimmed.slice(0, -1)}ies`;
  return `${trimmed}s`;
}

/**
 * What is wrong with a pair of nouns, in words an owner can act on.
 *
 * Warnings, not errors: these are guesses about English and the shop is the
 * authority on its own words. Blocking a save on them would be worse than the
 * mistake — a shop selling Mithai would be unable to say so.
 */
export function describeWordingProblems(overrides: LabelOverrides = {}): {
  productWord?: string;
  productWordPlural?: string;
} {
  const one = overrides.productWord?.trim() ?? "";
  const many = overrides.productWordPlural?.trim() ?? "";
  const problems: { productWord?: string; productWordPlural?: string } = {};

  if (one && many && one.toLowerCase() === many.toLowerCase()) {
    problems.productWordPlural =
      "Same as the singular, so “Add one” and “all of them” will read alike. Correct if that is genuinely the plural.";
  }
  // The mistake this shop actually made: a plural typed into the singular box,
  // which then reads "Add products" on every button.
  if (one.length > 3 && /[^s]s$/i.test(one)) {
    problems.productWord = `This box wants ONE — “Add ${one}” is what the button will say.`;
  }

  return problems;
}
