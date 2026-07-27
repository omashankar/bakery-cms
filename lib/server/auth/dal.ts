import { cache } from "react";

import { connectDB } from "@/lib/server/db/mongoose";
import { UserModel } from "@/lib/server/db/models/user.model";

import { getAccessCookie } from "./cookies";
import { AuthError, ForbiddenError } from "@/lib/server/http/errors";
import { verifyAccessToken, type AccessClaims } from "./jwt";

/**
 * Data Access Layer — the single place session validity is checked.
 *
 * Route handlers and Server Components call these instead of re-reading cookies,
 * so an auth check can never be forgotten. `cache()` memoises within one render
 * pass to avoid re-verifying on every call.
 */

/** Returns the verified access claims, or null if unauthenticated. Does not throw. */
export const getSession = cache(async (): Promise<AccessClaims | null> => {
  const token = await getAccessCookie();
  if (!token) return null;
  return verifyAccessToken(token);
});

/** Like getSession but throws AuthError when missing — use to guard endpoints. */
export async function requireSession(): Promise<AccessClaims> {
  const session = await getSession();
  if (!session) throw new AuthError();
  return session;
}

/** Throws ForbiddenError unless the current user's role is in `roles`. */
export async function requireRole(...roles: string[]): Promise<AccessClaims> {
  const session = await requireSession();
  if (!roles.includes(session.role)) throw new ForbiddenError();
  return session;
}

/** The current user document (safe DTO via model toJSON), or null. */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  await connectDB();
  const user = await UserModel.findById(session.sub);
  return user ? user.toJSON() : null;
});
