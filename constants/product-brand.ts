import type { Metadata } from "next";

/**
 * The metadata every VENDOR-facing route must set for itself.
 *
 * The root layout's `generateMetadata` builds the tab from the SHOP's settings —
 * its name as the title template, its favicon as the icon — which is right for
 * the storefront, the account pages and the admin, and wrong for the three
 * pages that are about the software rather than the shop.
 *
 * Left to inherit, `/platform` and `/platform/docs` served a client bakery's
 * Cloudinary icon in the browser tab, and `/design-system` titled itself
 * "Design System | Sweet Crumbs Bakery" because it used a plain-string title and
 * the root template filled in the rest. A prospect bookmarking the sales page
 * got a bakery's logo; the same prospect sent to admire the component library
 * found another client's name on it.
 *
 * That is not cosmetic. Sell to a second shop and each install's vendor pages
 * retitle and re-icon themselves after whichever database they point at — demo
 * two side by side and the sales page changes identity between them.
 *
 * So every vendor route spreads this and states an ABSOLUTE title. A plain
 * string re-enters the root template and the leak comes back;
 * `tests/domain/admin-surfaces-tell-the-truth.test.ts` fails if one forgets.
 */
export const PRODUCT_METADATA = {
  icons: { icon: "/platform-icon.svg" },
} satisfies Pick<Metadata, "icons">;
