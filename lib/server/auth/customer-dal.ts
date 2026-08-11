import { cache } from "react";

import { connectDB } from "@/lib/server/db/mongoose";
import { CustomerAccountModel } from "@/lib/server/db/models/customer-account.model";
import { AuthError, ForbiddenError } from "@/lib/server/http/errors";

import { getCustomerCookie } from "./cookies";
import { verifyCustomerToken, type CustomerClaims } from "./jwt";

/**
 * The storefront customer's session — the one place it is checked.
 *
 * Deliberately separate from `dal.ts`, which answers for the ADMIN. Mixing them
 * would mean one `requireSession()` that sometimes means "a member of staff" and
 * sometimes "a shopper", and every caller would have to remember which. The
 * token types cannot be confused either: `verifyCustomerToken` rejects an admin
 * token and `verifyAccessToken` rejects a customer one.
 *
 * A customer's authority is exactly "their own orders". It comes from `sub`, not
 * from any claim the token carries, so there is nothing here to escalate.
 */

/** The verified customer claims, or null. Never throws. */
export const getCustomerSession = cache(async (): Promise<CustomerClaims | null> => {
  const token = await getCustomerCookie();
  if (!token) return null;
  return verifyCustomerToken(token);
});

/**
 * The signed-in customer's ACCOUNT, re-read from the database.
 *
 * The token is not the last word on whether they may sign in: an account can be
 * deleted or blocked while a 30-day token is still valid, and a token cannot
 * know that. This is the check that makes blocking mean something.
 */
export const getCustomerAccount = cache(async () => {
  const session = await getCustomerSession();
  if (!session) return null;

  await connectDB();
  const account = await CustomerAccountModel.findById(session.sub);
  if (!account || account.blocked) return null;
  return account.toJSON();
});

/** The signed-in customer, or an AuthError. Use to guard storefront endpoints. */
export async function requireCustomer(): Promise<{ id: string; email: string; name: string }> {
  const account = (await getCustomerAccount()) as
    | { id: string; email: string; name: string; blocked?: boolean }
    | null;

  if (!account) {
    // A valid token whose account is gone or blocked is not a forbidden
    // request, it is an unauthenticated one — the right answer is "sign in
    // again", and the cookie is cleared by the route that catches this.
    const session = await getCustomerSession();
    if (session) throw new ForbiddenError("This account can no longer sign in");
    throw new AuthError();
  }

  return { id: account.id, email: account.email, name: account.name };
}
