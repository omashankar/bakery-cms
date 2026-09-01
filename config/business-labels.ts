import { Package, type LucideIcon } from "lucide-react";
import type { LabelOverrides } from "@/types/settings";

/**
 * The product-noun wording a shop shows its customers.
 *
 * This was a `Record<BusinessType, BusinessLabels>` — ten trades, each with its
 * own nouns, keyed off a closed enum in Settings. The enum decided nothing else
 * (it gated only the Wedding Builder), it had to be extended every time a shop
 * turned out to be a trade nobody had listed, and a shop selling cakes AND
 * chargers AND flowers had no honest value to pick. So the presets are gone and
 * the shop says what it sells, in `labelOverrides`.
 *
 * What remains is the FALLBACK — the wording used until a shop types its own.
 * Deliberately generic: a default that says "Cake" is the same bug in one row
 * instead of ten.
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
export function resolveLabels(overrides: LabelOverrides = {}): ResolvedLabels {
  const base = DEFAULT_LABELS;
  return {
    collectionsTitle: overrides.collectionsTitle?.trim() || base.collectionsTitle,
    collectionsSubtitle: overrides.collectionsSubtitle?.trim() || base.collectionsSubtitle,
    productWord: overrides.productWord?.trim() || base.productWord,
    productWordPlural: overrides.productWordPlural?.trim() || base.productWordPlural,
  };
}
