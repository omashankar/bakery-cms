import { getStorefrontContact } from "@/apps/website/lib/storefront-contact.server";
import { withErrorHandler } from "@/lib/server/http/errors";
import { ok } from "@/lib/server/http/response";

/**
 * The shop's contact details as `/store/contact` and `/store/faq` show them, for
 * the phone app.
 *
 * Not `/api/settings/public`'s raw `contact` block: the website reads these
 * through `getStorefrontContact`, which blanks a cleared field and a value still
 * equal to the shipped placeholder, so a shop never advertises a demo phone
 * number as its own. The app reads the same answer instead of re-deciding it.
 */
export const GET = withErrorHandler(async () =>
  ok(await getStorefrontContact(), "Storefront contact"),
);
