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
  const normalizedOptions =
    options.length > 0 && !options.some((option) => option.isDefault)
      ? options.map((option, index) => ({ ...option, isDefault: index === 0 }))
      : options;

  return {
    id: `group-${crypto.randomUUID().slice(0, 8)}`,
    name,
    type,
    required,
    options: normalizedOptions,
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
 * merchant configured, or the shipped defaults.
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
 * That one runs backfillLegacyGroups and forces isDefault, and takes photo-ness
 * straight off Product.isPhotoCake; this one does neither and DERIVES photo-ness
 * from allowsPhotoUpload or the category name. They disagree on the pricing
 * path, so folding them together would change what customers are charged.
 */
export function getProductVariantGroups(cake: LandingProduct): ProductVariantGroup[] {
  if (cake.variantGroups?.length) return cake.variantGroups;

  return createDefaultVariantGroups({
    isEggless: cake.isEggless,
    isPhotoCake:
      cake.allowsPhotoUpload === true || cake.category.toLowerCase().includes("photo"),
  });
}

export function normalizeVariantGroups(cake: Pick<Product, "variantGroups" | "isEggless" | "isPhotoCake">): ProductVariantGroup[] {
  if (cake.variantGroups?.length) {
    return backfillLegacyGroups(cake.variantGroups).map((group) => ({
      ...group,
      options: group.options.map((option, index) => ({
        ...option,
        isDefault: option.isDefault ?? index === 0,
      })),
    }));
  }

  return createDefaultVariantGroups({
    isEggless: cake.isEggless,
    isPhotoCake: cake.isPhotoCake,
  });
}

export function getDefaultVariantSelections(
  groups: ProductVariantGroup[]
): Record<string, string> {
  const selections: Record<string, string> = {};

  for (const group of groups) {
    const defaultOption =
      group.options.find((option) => option.isDefault) ?? group.options[0];
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
export function variantGroupsEnabledBy(
  groups: ProductVariantGroup[],
  modules: { eggEggless: boolean; photoCake: boolean },
): ProductVariantGroup[] {
  return groups.filter(
    (group) =>
      (group.type !== "egg" || modules.eggEggless) &&
      (group.type !== "photo" || modules.photoCake),
  );
}

export function calculateVariantAdjustment(
  groups: ProductVariantGroup[],
  selections: Record<string, string>
): number {
  return groups.reduce((total, group) => {
    const optionId = selections[group.id];
    const option =
      group.options.find((item) => item.id === optionId) ??
      group.options.find((item) => item.isDefault) ??
      group.options[0];

    return total + (option?.priceAdjustment ?? 0);
  }, 0);
}

/** Resolve the option a selection points at, falling back to the group default. */
function resolveSelectedOption(
  group: ProductVariantGroup,
  selections: Record<string, string>
): ProductVariantOption | null {
  const selectedId = selections[group.id];
  return (
    group.options.find((option) => option.id === selectedId) ??
    group.options.find((option) => option.isDefault) ??
    group.options[0] ??
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
