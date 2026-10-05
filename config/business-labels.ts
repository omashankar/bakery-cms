import { Package, type LucideIcon } from "lucide-react";
import type { LabelOverrides } from "@/types/settings";

/**
 * The product-noun wording a shop shows its customers.
 *
 * This was a `Record<BusinessType, BusinessLabels>` — ten trades, each with
 * its own nouns, keyed off a closed enum in Settings. The enum decided
 * nothing else, it had to be extended every time a shop turned out to be a
 * trade nobody had listed, and a shop selling cakes AND chargers AND flowers
 * had no honest value to pick. It was cut down to a wording preset, and now
 * it is gone: the shop that owns this deployment asked for it, because a
 * control labelled "What kind of shop is this?" reads as configuration and
 * only ever pre-filled four words.
 *
 * TWO LAYERS, not three. `DEFAULT_LABELS` is the neutral floor — a default
 * that says "Cake" is the same bug in one row instead of ten, so the floor
 * never does. And `labelOverrides` — what the shop actually typed — wins over
 * it, which is what keeps a shop selling cakes AND chargers AND flowers able
 * to say so.
 *
 * Scope is still intentionally small: public headings plus the
 * singular/plural product noun. Routes, folders, components and database
 * collections are never renamed from here.
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
   * WHAT THIS SHOP CALLS THE THREE THINGS IT FILES PRODUCTS UNDER.
   *
   * "Category", "Occasion" and "Collection" were hardcoded English, on a screen
   * whose entire job is letting a shop describe its own goods — while the word
   * for the goods themselves has been configurable all along. A phone shop
   * files under Brands, a florist sells for Festivals, a bookshop curates
   * Staff Picks. None of them are choosing between three fixed nouns.
   *
   * Singular AND plural stored, for the same reason `productWordPlural` is a
   * field rather than a guess: the rules are English ones and a shop typing
   * Shreni or Mithai gets a wrong guess it must be able to correct.
   *
   * WORDING ONLY. The route is still /store/occasions, the tab id is still
   * "occasions", and the database section is still `occasions` — renaming any
   * of those from here is how a label becomes a migration.
   */
  categoryWord: string;
  categoryWordPlural: string;
  occasionWord: string;
  occasionWordPlural: string;
  collectionWord: string;
  collectionWordPlural: string;
  /*
    THE KIND OF THING, above the category that says which kind.

    A gift shop may call these Departments, a supermarket Aisles, a bookshop
    Sections. Neutral by default, like every other word here — the shop types
    its own or keeps this one.
  */
  departmentWord: string;
  departmentWordPlural: string;
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
  categoryWord: "Category",
  categoryWordPlural: "Categories",
  occasionWord: "Occasion",
  occasionWordPlural: "Occasions",
  collectionWord: "Collection",
  collectionWordPlural: "Collections",
  departmentWord: "Department",
  departmentWordPlural: "Departments",
  productIcon: Package,
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
  categoryWord: string;
  categoryWordPlural: string;
  occasionWord: string;
  occasionWordPlural: string;
  collectionWord: string;
  collectionWordPlural: string;
  departmentWord: string;
  departmentWordPlural: string;
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
/**
 * TWO LAYERS NOW, NOT THREE — what the shop TYPED, over the neutral default.
 *
 * The middle layer was a trade preset picked from a "What kind of shop is
 * this?" dropdown, and the shop asked for it to go. It decided nothing else:
 * it gated no feature, and its own docblock already recorded that it "had to
 * be extended every time a shop turned out to be a trade nobody had listed"
 * and that a shop selling cakes AND chargers AND flowers "had no honest value
 * to pick".
 *
 * NOTHING THIS DEPLOYMENT RENDERS MOVED. Its stored type was `"other"`, whose
 * preset was the empty object — so `DEFAULT_LABELS` already stood. Verified
 * against the live settings document before the change, not assumed.
 *
 * What a shop loses is a shortcut on its first day: a florist used to get
 * Bouquet/Flowers pre-filled and now types them. What it stops being able to
 * do is change its whole storefront's wording from a dropdown that showed no
 * sign of having done so.
 */
export function resolveLabels(overrides: LabelOverrides = {}): ResolvedLabels {
  const base = DEFAULT_LABELS;
  const productWord = overrides.productWord?.trim() || base.productWord;
  return {
    collectionsTitle: overrides.collectionsTitle?.trim() || base.collectionsTitle,
    collectionsSubtitle: overrides.collectionsSubtitle?.trim() || base.collectionsSubtitle,
    productWord,
    productWordPlural: overrides.productWordPlural?.trim() || base.productWordPlural,
    descriptionHeading: overrides.descriptionHeading?.trim() || base.descriptionHeading,
    categoryWord: overrides.categoryWord?.trim() || base.categoryWord,
    categoryWordPlural: overrides.categoryWordPlural?.trim() || base.categoryWordPlural,
    occasionWord: overrides.occasionWord?.trim() || base.occasionWord,
    occasionWordPlural: overrides.occasionWordPlural?.trim() || base.occasionWordPlural,
    collectionWord: overrides.collectionWord?.trim() || base.collectionWord,
    collectionWordPlural: overrides.collectionWordPlural?.trim() || base.collectionWordPlural,
    departmentWord: overrides.departmentWord?.trim() || base.departmentWord,
    departmentWordPlural: overrides.departmentWordPlural?.trim() || base.departmentWordPlural,
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
