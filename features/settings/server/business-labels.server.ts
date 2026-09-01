import { resolveLabels, type ResolvedLabels } from "@/config/business-labels";
import type { LabelOverrides } from "@/types/settings";

/**
 * Server-side white-label resolution: the per-business-type default wording
 * (config/business-labels.ts) with any admin overrides layered on top.
 *
 * The resolution itself now LIVES in config/business-labels.ts, because it is
 * pure and both sides need it. While it was only here, `useBusinessLabels`
 * could not call it — so the browser resolved from `businessType` alone and
 * threw the overrides away, and `labelOverrides` reached no screen despite the
 * server computing it correctly on every request.
 *
 * This module stays as the server's entry point so existing imports keep
 * working and the boundary is still stated in one place.
 */
export { resolveLabels };
export type { ResolvedLabels, LabelOverrides };
