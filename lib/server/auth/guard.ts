import { NextResponse } from "next/server";

import { requireAnyPermission, type Actor } from "./access";
import { AppError } from "@/lib/server/http/errors";
import type { Permission } from "@/features/team/lib/permissions";

/**
 * Permission guard for the legacy-shape routes that return a plain `{ error }`
 * NextResponse directly (instead of going through `withErrorHandler`). Returns
 * the caller on success, or a 401/403 `{ error }` NextResponse when they are not
 * signed in or hold NONE of the permissions listed.
 *
 * Usage inside a fat route handler:
 *   const auth = await requirePermissionResponse("pages.manage");
 *   if (auth instanceof NextResponse) return auth;
 */
export async function requirePermissionResponse(
  ...anyOf: [Permission, ...Permission[]]
): Promise<Actor | NextResponse> {
  try {
    return await requireAnyPermission(...anyOf);
  } catch (error) {
    const status = error instanceof AppError ? error.status : 401;
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status });
  }
}
