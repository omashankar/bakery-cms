import "server-only";

import { getSession } from "@/lib/server/auth/dal";

const ADMIN_ROLES = ["owner", "admin"];

/**
 * A screen's first data, read on the server so it arrives in the HTML.
 *
 * Every admin screen used to render an empty shell, download and hydrate its
 * JavaScript, and only then ask its API for the rows it shows — measured on a
 * throttled phone, the orders list appeared at 7.1s, the product list at 7.4s.
 * Read here, the same rows are in the first response.
 *
 * Null when there is no admin session or the read fails: the screen then
 * fetches as it always did, so this can only ever make it faster, never
 * different. The API routes keep their own role checks.
 */
export async function whenAdmin<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    const session = await getSession();
    if (!session || !ADMIN_ROLES.includes(session.role)) return null;
    return await read();
  } catch {
    return null;
  }
}
