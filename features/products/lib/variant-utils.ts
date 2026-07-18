import type {
  Product,
  ProductVariantGroup,
  ProductVariantGroupType,
  ProductVariantOption,
  VariantOptionSemantic,
} from "@/types/product";

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
export function syncLegacyFlagsFromVariants(
  groups: ProductVariantGroup[],
  selections: Record<string, string>
): { isEggless: boolean; isPhotoCake: boolean } {
  return {
    isEggless: isSelectionSemantic(groups, "egg", "eggless", selections),
    isPhotoCake: offersSemantic(groups, "photo-print"),
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
