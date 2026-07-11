import type {
  Cake,
  ProductVariantGroup,
  ProductVariantGroupType,
  ProductVariantOption,
} from "@/types/cake";

export function createVariantOption(
  label: string,
  priceAdjustment = 0,
  isDefault = false
): ProductVariantOption {
  return {
    id: `opt-${crypto.randomUUID().slice(0, 8)}`,
    label,
    priceAdjustment,
    isDefault,
  };
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
        createVariantOption("Eggless", 80, Boolean(input?.isEggless)),
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
          createVariantOption("Custom photo print", 250, false),
        ],
        false
      )
    );
  }

  return groups;
}

export function normalizeVariantGroups(cake: Pick<Cake, "variantGroups" | "isEggless" | "isPhotoCake">): ProductVariantGroup[] {
  if (cake.variantGroups?.length) {
    return cake.variantGroups.map((group) => ({
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

export function syncLegacyFlagsFromVariants(
  groups: ProductVariantGroup[],
  selections: Record<string, string>
): { isEggless: boolean; isPhotoCake: boolean } {
  const eggGroup = groups.find((group) => group.type === "egg");
  const photoGroup = groups.find((group) => group.type === "photo");

  const eggOption = eggGroup
    ? getVariantOption(groups, eggGroup.id, selections[eggGroup.id] ?? "")
    : null;

  const photoOption = photoGroup
    ? getVariantOption(groups, photoGroup.id, selections[photoGroup.id] ?? "")
    : null;

  return {
    isEggless: eggOption?.label.toLowerCase().includes("eggless") ?? false,
    isPhotoCake:
      photoGroup !== undefined &&
      (photoOption?.label.toLowerCase().includes("photo") ?? false),
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
