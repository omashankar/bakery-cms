import type {
  Product,
  ProductVariantGroup,
  ProductVariantGroupType,
  ProductVariantOption,
} from "@/types/product";
import type { LandingProduct } from "@/constants/landing-data";

export function createVariantOption(
  label: string,
  priceAdjustment = 0,
  isDefault = false,
): ProductVariantOption {
  return {
    id: `opt-${crypto.randomUUID().slice(0, 8)}`,
    label,
    priceAdjustment,
    isDefault,
  };
}

/*
  `backfillSemantic` and `backfillLegacyGroups` stood here: a one-time
  migration that read an option's LABEL — the only place in the codebase
  allowed to — so that options stored before `semantic` existed could be
  upgraded to carry one.

  There are no semantics left to backfill. Both values were bakery special
  cases and both have gone, so an option is what its label and its price say
  and nothing more. Stored options keep whatever `semantic` key they were
  saved with; nothing reads it, and Mongoose keeps it because `variantGroups`
  is Mixed.
*/

export function createVariantGroup(
  name: string,
  type: ProductVariantGroupType,
  options: ProductVariantOption[],
  required = true
): ProductVariantGroup {
  /*
    NO DEFAULT IS INVENTED HERE ANY MORE.
    
    This promoted the first option whenever none was marked, which made every
    group mandatory the moment it was created — the admin could add “Eggless
    +₹80” and the page would charge for it before anybody ticked anything.
    Both callers pass what they mean: the seeded egg and photo groups name
    their default explicitly, and a group added by hand starts as an add-on.
  */

  return {
    id: `group-${crypto.randomUUID().slice(0, 8)}`,
    name,
    type,
    required,
    options,
  };
}

/**
 * The groups a brand-new product starts with.
 *
 * It used to open with an "Egg preference" row on every product a shop ever
 * created — a bakery question asked of a charger, and a special case in the
 * type system to carry it. A shop that wants to offer eggless makes an
 * ordinary option named Eggless and prices it; the page renders any two-option
 * group as a single tickbox already.
 *
 * So this now starts EMPTY unless a photo print was asked for.
 */

/**
 * The variant groups a storefront product is actually sold in: the ones the
 * merchant configured, and only those. It no longer falls back to shipped
 * defaults — see the note below on why that fallback was both wrong and a
 * TypeError waiting to happen.
 *
 * This used to live at apps/website/lib/product-details.ts, next to the gallery
 * and badge formatters, because the product page was the first thing that had
 * to render a picker. But server-side cart pricing calls it —
 * features/checkout/server/pricing.server.ts feeds its result through
 * variantGroupsEnabledBy and into calculateProductUnitPrice — so the shop could
 * not work out what a cake COSTS without loading the customer website's UI
 * layer, and no other storefront could reuse the pricing at all.
 *
 * Not the same function as normalizeVariantGroups below, despite the shape.
 * That one forces isDefault; this one does not.
 * Keep them separate — they sit on different paths and have disagreed before.
 *
 * IT NO LONGER INVENTS GROUPS FOR A PRODUCT THAT HAS NONE, for two reasons.
 *
 * The first is the point of the change: a shop selling a phone charger was
 * handed an "Egg preference" group (Regular / Eggless +80) it never configured,
 * on the picker, in the price, and on the order line. A product's options are
 * the merchant's to declare; absent is a valid answer.
 *
 * The second is a latent crash this fallback was hiding. It read
 * `cake.category`, but the pricing path calls this with a repository `Product`,
 * which declares `categoryId` and has no `category` at all — so the branch was
 * a TypeError waiting for the first product to arrive without stored groups,
 * and `/api/checkout/quote` would have answered 500 rather than a clean 409.
 * Every pricing fixture in the suite set `category` by hand, so nothing caught
 * it. `tests/domain/a-product-that-is-not-a-cake.test.ts` now reproduces it.
 *
 * Verified against this shop's own data before changing: all 29 products carry
 * stored `variantGroups`, so no live product's price moves.
 */
export function getProductVariantGroups(cake: LandingProduct): ProductVariantGroup[] {
  return cake.variantGroups ?? [];
}

/**
 * Stored groups, made safe to read — never invented ones.
 *
 * This runs on EVERY repository read (`normalizeCommerceFields`), so its old
 * fallback is what put an "Egg preference" group on every product in the shop
 * that had not configured its own, whatever that product was. The merchant
 * declares a product's options; no options is a valid answer, and there is no
 * longer any function that builds one nobody asked for — the two it used to
 * build, egg preference and photo cake, were both bakery special cases.
 */
export function normalizeVariantGroups(cake: Pick<Product, "variantGroups">): ProductVariantGroup[] {
  if (!cake.variantGroups?.length) return [];

  return cake.variantGroups.map((group) => {
    /**
     * "First option wins" is a fallback for a group that names no default —
     * not a vote each option casts on its own.
     *
     * This was `option.isDefault ?? index === 0` evaluated per option, so a
     * group whose SECOND option was explicitly the default, and whose first
     * simply omitted the key, came back with TWO options marked default. Every
     * consumer resolves with `.find(o => o.isDefault)`, which returns the
     * first — so the merchant's chosen default was silently replaced by the
     * one above it, in the picker and in `calculateVariantAdjustment`, which
     * is what a line is charged when the customer sends no selection.
     */
    const named = group.options.some((option) => option.isDefault);

    return {
      ...group,
      options: group.options.map((option, index) => ({
        ...option,
        isDefault: option.isDefault ?? (!named && index === 0),
      })),
    };
  });
}

export function getDefaultVariantSelections(
  groups: ProductVariantGroup[]
): Record<string, string> {
  const selections: Record<string, string> = {};

  for (const group of groups) {
    /**
     * A group that names NO default starts with nothing selected.
     *
     * This fell back to the first option, so every group was always answered
     * and always charged — which made an opt-in impossible to express. A shop
     * adding one option, “Eggless +₹80”, and leaving Default clear means
     * exactly what it looks like: the customer does not have it until they
     * ask for it.
     *
     * Legacy data is unaffected. `normalizeVariantGroups` still marks the
     * first option of a group whose options carry no `isDefault` KEY AT ALL,
     * which is what an import or a pre-`createVariantOption` row looks like —
     * so those keep the option they have always been charged for.
     */
    const defaultOption = group.options.find((option) => option.isDefault);
    if (defaultOption) {
      selections[group.id] = defaultOption.id;
    }
  }

  return selections;
}

export function getVariantOption(
  groups: ProductVariantGroup[],
  groupId: string,
  optionId: string
): ProductVariantOption | null {
  const group = groups.find((item) => item.id === groupId);
  if (!group) return null;
  return group.options.find((option) => option.id === optionId) ?? null;
}

/**
 * The variant groups a shop with these modules actually sells.
 *
 * A module that is off used to hide only the PICKER — "the group stays in the
 * data + pricing", as the product page's own comment put it. So a shop that
 * switched Egg/Eggless off still had every eggless cake charged its +₹80
 * default and every order line stamped "Egg preference: Eggless", for a choice
 * the customer was never shown and a feature the shop had turned off.
 * `calculateVariantAdjustment` falls back to a group's default option when no
 * selection is sent, so simply not sending one does not stop the charge — the
 * group has to be gone.
 *
 * The flavour and shape pickers on the same page were already gated for exactly
 * this reason: "an order line must not record a choice the customer was never
 * shown". These two were the ones left.
 */
/**
 * A group that is really a yes-or-no, or null.
 *
 * Two options, exactly one of which costs nothing and is the default. That is
 * an ADD-ON — “make it eggless”, “make it a heart” — and a tick says it in one
 * line where a titled row of two buttons needed three.
 *
 * Read off the data, not the group’s name: naming it “Eggless” is the shop’s
 * business, and a rule keyed on that would break the moment somebody wrote
 * “Egg preference”. A three-way choice stays buttons, because it is one.
 *
 * Here rather than inside the product page because it is a rule about VARIANT
 * DATA, like every other function in this file, and the cart has to reach the
 * same verdict about the same group.
 */
/**
 * A legacy flat value — a `shape`, a `flavour` — matched onto a real option.
 *
 * `shapes: string[]` and `flavourOptions: string[]` were unpriced lists of
 * names with their own hard-coded pickers; both are variant groups now. Two
 * kinds of line still carry the old flat field: one built by Reorder from an
 * order placed before the change, and one sitting in a browser’s localStorage
 * cart from before the deploy — carts have no expiry, so those keep arriving.
 *
 * Returns null where there is nothing to map, which is the signal to LEAVE the
 * old value alone: a shape or flavour the group cannot answer for is the
 * customer’s own word, and deleting it bakes the default with no record that
 * somebody asked for something else.
 *
 * Shared by the server pricing and the product page’s edit restore, because a
 * line has to mean the same thing on both.
 */
export function mapLegacyChoice(
  group: ProductVariantGroup | undefined,
  value: string | undefined,
  carried: Record<string, string>,
): { groupId: string; optionId: string } | null {
  const wanted = typeof value === "string" ? value.trim() : "";
  // A real selection always wins: a line from AFTER the change carries one, and
  // the legacy field must not override it.
  if (!group || !wanted || carried[group.id]) return null;

  const option = group.options.find(
    (candidate) => candidate.label.trim().toLowerCase() === wanted.toLowerCase(),
  );
  return option ? { groupId: group.id, optionId: option.id } : null;
}

export function asAddOn(
  group: ProductVariantGroup,
): { off: ProductVariantOption | null; on: ProductVariantOption; extra: number } | null {
  /**
   * ONE OPTION AND NO DEFAULT is the plainest add-on there is.
   *
   * A shop types “Eggless”, puts ₹80 beside it, and leaves Default clear. The
   * customer either wants it or does not; there is no second option because
   * not-wanting-it is not a thing the shop sells. Unticked selects nothing at
   * all and costs nothing, which is what `getDefaultVariantSelections` and
   * `calculateVariantAdjustment` now mean by an unanswered group.
   *
   * One option WITH a default is not this. That is a fact about the product —
   * it comes this way — and a box the customer cannot untick is not a choice.
   */
  if (group.options.length === 1) {
    const only = group.options[0];
    if (!only || only.isDefault) return null;
    return { off: null, on: only, extra: only.priceAdjustment };
  }

  if (group.options.length !== 2) return null;

  /**
   * The OFF state is the group’s default, whatever it costs.
   *
   * This looked for an option priced at exactly zero and refused everything
   * else — so a shop whose base option carries a small charge of its own
   * (“Regular +₹3”, “Eggless +₹80”) got two buttons and a heading for what is
   * plainly one yes-or-no question. Nothing about a tick needs the unticked
   * side to be free; it needs to be what the customer gets by not ticking,
   * which is the default and only the default.
   */
  const off = group.options.find((option) => option.isDefault) ?? group.options[0];
  const on = group.options.find((option) => option !== off);
  if (!on) return null;

  /**
   * What ticking actually ADDS — the difference, not the raw adjustment.
   *
   * With a default of +₹3 and an upgrade of +₹80 the box must say +₹77: the
   * ₹3 is already inside the price shown above it, so printing +₹80 would
   * overstate the upgrade by exactly the amount the customer is paying either
   * way — and the total would then move by less than the label promised.
   */
  const extra = on.priceAdjustment - off.priceAdjustment;

  /**
   * Nothing to upgrade to, or an upgrade that costs less than the default.
   *
   * Both sides equal is a choice with no upgrade in it — Round or Square,
   * neither costing more — and a tick would have to pick one of them to be
   * “off” with nothing to say why. Cheaper-than-default is worse: the box
   * would start unticked at the HIGHER price, so the page and the grid card,
   * which prices each group’s default, would disagree by exactly that much.
   */
  if (extra <= 0) return null;

  return { off, on, extra };
}

/**
 * The rest of the sentence `asAddOn` starts three comments above.
 *
 * It says: “One option WITH a default is not this. That is a fact about the
 * product — it comes this way — and a box the customer cannot untick is not a
 * choice.” It then returns null and leaves the group to the picker path, where
 * it renders as a bold heading over a single already-pressed button. The shop
 * has been shown, on this page, a control that offers nothing to control.
 *
 * A shop describes a cake it only makes eggless by typing one option, Eggless,
 * and ticking Default. That is not a question; it is the answer, and the
 * reference storefront prints exactly that: a tick, and the word.
 *
 *   ✓ Eggless        ✓ Waterproof        ✓ Ships assembled
 *
 * The predicate is the EXACT complement of `asAddOn`'s one-option branch — that
 * branch returns null precisely when `only.isDefault` is truthy, and its other
 * branch needs two options — so a group lands in exactly one of the three
 * buckets by construction rather than by the two of them agreeing to be careful.
 * `asAddOn` is not touched: it is the fence that keeps a fact out of the tick
 * path, where a customer could untick something the page called already true.
 *
 * Reads the option count, one boolean and whether the label is blank. Nothing
 * else — not `group.type` (the union is "shape" | "custom" while live rows carry
 * `egg` and `photo`, so a two-case switch typechecks as exhaustive and is wrong
 * for most of the catalogue), not the name, not what the label SAYS, and not
 * `required`, which is documented inert and is true on two live paid opt-ins.
 */
export function asStatement(group: ProductVariantGroup): ProductVariantOption | null {
  if (group.options.length !== 1) return null;

  const only = group.options[0];
  if (!only?.isDefault) return null;
  // A tick with nothing after it states nothing — the emptiness guard
  // `OptionGroup` already applies to a group with no options to show.
  if (typeof only.label !== "string" || !only.label.trim()) return null;

  return only;
}

export function variantGroupsEnabledBy(
  groups: ProductVariantGroup[],
  /**
   * `shape` joined these when the flat `shapes: string[]` became a typed
   * group. It is REQUIRED rather than optional: this function is the one gate
   * the storefront, the card projection and the server’s pricing all share, so
   * a caller that forgot to pass it would price a group the page had hidden.
   */
  modules: { shape: boolean },
): ProductVariantGroup[] {
  return groups.filter((group) => group.type !== "shape" || modules.shape);
}

export function calculateVariantAdjustment(
  groups: ProductVariantGroup[],
  selections: Record<string, string>
): number {
  return groups.reduce((total, group) => {
    const optionId = selections[group.id];
    /**
     * No selection and no default means NOTHING, not the first option.
     *
     * The default is still substituted when there is one — a group the shop
     * answers on the customer's behalf must be charged whether or not the
     * browser sent the selection, which is what stops a crafted request
     * dropping a surcharge. But falling through to `options[0]` charged for a
     * choice nobody had made and no default claimed.
     */
    const option =
      group.options.find((item) => item.id === optionId) ??
      group.options.find((item) => item.isDefault);

    return total + (option?.priceAdjustment ?? 0);
  }, 0);
}


/*
  `isSelectionSemantic` stood here, and its only caller was the egg branch of
  `syncLegacyFlagsFromVariants` — the one that asked whether the option a
  customer had landed on MEANT eggless. Nothing asks that any more: a shop
  that sells an eggless version sells it as an option with a price, and a shop
  whose product simply is eggless says so in its name.
*/

/*
  `offersSemantic` stood here, and one call site left: it asked whether a
  product offered a paid photo print, which is how `isPhotoCake` was derived.
  A product that takes a photograph says so with `allowsPhotoUpload` and
  prices it into its own price — there is no second option to offer.
*/

/*
  `setGroupDefaultBySemantic` stood here. Its only caller was the admin's
  "Eggless" tick, which moved a group's default onto the eggless option so the
  flag and the variant data could not disagree. Both halves of that pair have
  gone: the tick, and the flag it kept in step with.
*/

/*
  `syncLegacyFlagsFromVariants` stood here, and it derived two flags from what
  a product's options MEANT: `isEggless` and `isPhotoCake`.

  Both are gone, and the last one for the reason the shop gave: if a product
  takes a photograph, it takes one — there is no second, dearer version to
  choose between, and the price of printing is part of the price of the thing.
  `allowsPhotoUpload` is the whole statement, and an admin tick is the only
  place it can come from.
*/

export function formatPreparationTime(minutes?: number): string | null {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min prep`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) return `${hours} hr prep`;
  return `${hours} hr ${remainder} min prep`;
}

export function formatShelfLife(days?: number): string | null {
  if (!days || days <= 0) return null;
  if (days === 1) return "Best within 24 hours";
  return `Best within ${days} days`;
}
