import { getBusinessLabels } from "@/config/business-labels";
import type { BusinessType } from "@/types/settings";

/**
 * Server-side white-label resolution: the per-business-type default wording
 * (config/business-labels.ts) with any admin overrides layered on top.
 *
 * Only the STRING labels are resolved here — the `productIcon` (a React
 * component) stays on the client, since it cannot cross an API boundary.
 */
export interface ResolvedLabels {
  collectionsTitle: string;
  collectionsSubtitle: string;
  productWord: string;
  productWordPlural: string;
}

export interface LabelOverrides {
  collectionsTitle?: string;
  collectionsSubtitle?: string;
  productWord?: string;
  productWordPlural?: string;
}

export function resolveLabels(
  businessType: BusinessType,
  overrides: LabelOverrides = {},
): ResolvedLabels {
  const base = getBusinessLabels(businessType);
  return {
    collectionsTitle: overrides.collectionsTitle?.trim() || base.collectionsTitle,
    collectionsSubtitle: overrides.collectionsSubtitle?.trim() || base.collectionsSubtitle,
    productWord: overrides.productWord?.trim() || base.productWord,
    productWordPlural: overrides.productWordPlural?.trim() || base.productWordPlural,
  };
}
