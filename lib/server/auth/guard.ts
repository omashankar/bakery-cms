import { NextResponse } from "next/server";

import { requireRole } from "./dal";
import { AppError } from "@/lib/server/http/errors";
import type { AccessClaims } from "./jwt";

/**
 * Admin guard for the legacy-shape routes that return a plain `{ error }`
 * NextResponse directly (instead of going through `withErrorHandler`). Returns
 * the session claims on success, or a 401/403 `{ error }` NextResponse when the
 * caller is not an authenticated owner/admin.
 *
 * Usage inside a fat route handler:
 *   const auth = await requireAdminResponse();
 *   if (auth instanceof NextResponse) return auth;
 */
export async function requireAdminResponse(): Promise<AccessClaims | NextResponse> {
  try {
    return await requireRole("owner", "admin");
  } catch (error) {
    const status = error instanceof AppError ? error.status : 401;
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status });
  }
}
