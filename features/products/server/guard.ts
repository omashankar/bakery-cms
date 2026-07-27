import { NextResponse } from "next/server";

import { requireRole } from "@/lib/server/auth/dal";
import { AppError } from "@/lib/server/http/errors";
import type { AccessClaims } from "@/lib/server/auth/jwt";

/**
 * Admin guard for the legacy-shape product routes. Returns the session claims,
 * or a `{ error }` NextResponse (matching the routes' existing error shape) when
 * the caller isn't an authorised admin. Product-mutating requests must pass this.
 */
export async function requireProductAdmin(): Promise<AccessClaims | NextResponse> {
  try {
    return await requireRole("owner", "admin");
  } catch (error) {
    const status = error instanceof AppError ? error.status : 401;
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status });
  }
}
