import type { NextResponse } from "next/server";

import { requirePermissionResponse } from "@/lib/server/auth/guard";
import type { Actor } from "@/lib/server/auth/access";
import type { Permission } from "@/features/team/lib/permissions";

/**
 * Guard for the legacy-shape product routes. Returns the caller, or a
 * `{ error }` NextResponse (matching the routes' existing error shape) when they
 * lack the permission. Viewing, creating, editing and deleting are separate
 * permissions — "can edit a price" must not imply "can delete the product".
 */
export async function requireProductPermission(
  permission: Extract<Permission, `products.${string}`>,
): Promise<Actor | NextResponse> {
  return requirePermissionResponse(permission);
}
