import type {
  Product,
  ProductVariantGroup,
  ProductVariantGroupType,
  ProductVariantOption,
  VariantOptionSemantic,
} from "@/types/product";
import type { LandingProduct } from "@/constants/landing-data";

export function createVariantOption(
  label: string,
  priceAdjustment = 0,
  isDefault = false,
  semantic?: VariantOptionSemantic
): ProductVariantOption {
  return {
    id: `opt-${crypto.randomUUID().slice(0, 8)}`,
    label,
    ...(semantic ? { semantic } : {}),
    priceAdjustment,
    isDefault,
  };
}

/**
 * One-time migration for options stored before `semantic` existed.
 *
 * This is the ONLY place a label may be inspected, and only to upgrade legacy
 * records. New code must read `option.semantic`.
 */
function backfillSemantic(
  option: ProductVariantOption,
  groupType: ProductVariantGroupType
): ProductVariantOption {
  if (option.semantic) return option;

  const label = option.label.toLowerCase();
  if (groupType === "egg" && label.includes("eggless")) {
    return { ...option, semantic: "eggless" };
  }
  if (groupType === "photo" && label.includes("photo")) {
    return { ...option, semantic: "photo-print" };
  }
  return option;
}

/** Upgrade stored groups to carry explicit semantics. Idempotent. */
export function backfillLegacyGroups(groups: ProductVariantGroup[]): ProductVariantGroup[] {
  return groups.map((group) => ({
    ...group,
    options: group.options.map((option) => backfillSemantic(option, group.type)),
  }));
}

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

export function createDefaultVariantGroups(input?: {
  isEggless?: boolean;
  isPhotoCake?: boolean;
}): ProductVariantGroup[] {
  const groups: ProductVariantGroup[] = [
    createVariantGroup(
      "Egg preference",
      "egg",
      [
        createVariantOption("Regular", 0, !input?.isEggless),
        createVariantOption("Eggless", 80, Boolean(input?.isEggless), "eggless"),
      ]
    ),
  ];

  if (input?.isPhotoCake) {
    groups.push(
      createVariantGroup(
        "Photo cake",
        "photo",
        [
          createVariantOption("Standard design", 0, true),
          createVariantOption("Custom photo print", 250, false, "photo-print"),
        ],
        false
      )
    );
  }

  return groups;
}

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
 * That one runs backfillLegacyGroups and forces isDefault; this one does not.
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
 * declares a product's options; no options is a valid answer, and
 * `createDefaultVariantGroups` is still exported for the Options tab's
 * "Add egg / eggless" button, where a human is asking for it. (That button
 * used to be "Reset to defaults" and REPLACED the array, which is why it is
 * now additive and gated on the module.)
 */
export function normalizeVariantGroups(cake: Pick<Product, "variantGroups" | "isEggless" | "isPhotoCake">): ProductVariantGroup[] {
  if (!cake.variantGroups?.length) return [];

  return backfillLegacyGroups(cake.variantGroups).map((group) => {
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

export function variantGroupsEnabledBy(
  groups: ProductVariantGroup[],
  /**
   * `shape` joined these when the flat `shapes: string[]` became a typed
   * group. It is REQUIRED rather than optional: this function is the one gate
   * the storefront, the card projection and the server’s pricing all share, so
   * a caller that forgot to pass it would price a group the page had hidden.
   */
  modules: { eggEggless: boolean; photoCake: boolean; shape: boolean },
): ProductVariantGroup[] {
  return groups.filter(
    (group) =>
      (group.type !== "egg" || modules.eggEggless) &&
      (group.type !== "photo" || modules.photoCake) &&
      (group.type !== "shape" || modules.shape),
  );
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

/**
 * The option a selection points at, or the group's default, or nothing.
 *
 * Nothing is a real answer: a group the customer opted out of has no option,
 * and a cart line that named one anyway would tell the kitchen to make
 * something nobody asked for.
 */
function resolveSelectedOption(
  group: ProductVariantGroup,
  selections: Record<string, string>
): ProductVariantOption | null {
  const selectedId = selections[group.id];
  return (
    group.options.find((option) => option.id === selectedId) ??
    group.options.find((option) => option.isDefault) ??
    null
  );
}

/** True when the chosen option of this group carries the given meaning. */
export function isSelectionSemantic(
  groups: ProductVariantGroup[],
  groupType: ProductVariantGroupType,
  semantic: VariantOptionSemantic,
  selections: Record<string, string>
): boolean {
  const group = groups.find((item) => item.type === groupType);
  if (!group) return false;
  return resolveSelectedOption(group, selections)?.semantic === semantic;
}

/** True when the product offers an option with the given meaning at all. */
export function offersSemantic(
  groups: ProductVariantGroup[],
  semantic: VariantOptionSemantic
): boolean {
  return groups.some((group) => group.options.some((option) => option.semantic === semantic));
}

/**
 * Move a group's default onto (or off) the option carrying `semantic`.
 *
 * This is what keeps an admin toggle and the variant system in agreement: the
 * toggle expresses intent, and the variant data is updated to match it.
 * Returns the original array when the group or option is absent.
 */
export function setGroupDefaultBySemantic(
  groups: ProductVariantGroup[],
  groupType: ProductVariantGroupType,
  semantic: VariantOptionSemantic,
  enabled: boolean
): ProductVariantGroup[] {
  const group = groups.find((item) => item.type === groupType);
  if (!group) return groups;

  const target = enabled
    ? group.options.find((option) => option.semantic === semantic)
    : group.options.find((option) => option.semantic !== semantic);
  if (!target) return groups;

  return groups.map((item) =>
    item.id === group.id
      ? {
          ...item,
          options: item.options.map((option) => ({
            ...option,
            isDefault: option.id === target.id,
          })),
        }
      : item
  );
}

/**
 * Derive the legacy product flags from the variant system.
 *
 * The two flags mean different things, which is why they are computed differently:
 *
 * - `isEggless` — the product ITSELF is eggless, i.e. its chosen/default egg
 *   option is the eggless one. A regular cake that merely offers an eggless
 *   upgrade is not an eggless cake.
 * - `isPhotoCake` — the product OFFERS photo printing. The photo group's default
 *   is deliberately "Standard design" (the print is a paid upsell), so deriving
 *   this from the default selection would make it permanently false.
 */
/**
 * Derive the legacy flags from the variant data — but only where there IS any.
 *
 * `isEggless` was derived unconditionally, so a product with no egg variant
 * group had the tick overwritten with `false` on save: the admin ticked
 * "Eggless", saved, and it came back unticked, with the eggless filter and badge
 * never applying. Most products have no such group.
 *
 * `current` is what the form holds. Where the variants cannot answer, it stands.
 */
export function syncLegacyFlagsFromVariants(
  groups: ProductVariantGroup[],
  selections: Record<string, string>,
  current?: { isEggless?: boolean; isPhotoCake?: boolean }
): { isEggless: boolean; isPhotoCake: boolean } {
  // Groups are addressed by `type`, which is what `isSelectionSemantic` matches
  // on — not by a `semantic` field, which groups do not carry.
  const hasEggGroup = groups.some((group) => group.type === "egg");

  return {
    isEggless: hasEggGroup
      ? isSelectionSemantic(groups, "egg", "eggless", selections)
      : (current?.isEggless ?? false),
    // Photo printing is an offer, not a selection: if no group offers it, the
    // admin's own tick is the only statement there is.
    isPhotoCake: offersSemantic(groups, "photo-print") || (current?.isPhotoCake ?? false),
  };
}

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
