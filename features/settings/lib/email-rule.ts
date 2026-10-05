import { z } from "zod";

/**
 * The ONE email rule, shared by the form and the schema.
 *
 * The Contact form restated it as a regex "deliberately matching what Zod's
 * `z.email()` accepts" — and it did not, in either direction. `o'brien@bakery.ie`
 * is a legal address that Zod takes and the regex refused, so the field showed
 * "Enter a valid email address", Save stayed disabled for the WHOLE Contact
 * section, and the shop could not change its address, phone or opening hours
 * either until the owner used a different email.
 *
 * Restating a rule is how the two drift. `isSafeAssetUrl`, `isValidMapEmbedUrl`
 * and `isSafeSocialUrl` are already shared between the form and the schema for
 * exactly this reason; this is the fourth.
 *
 * ---
 *
 * IN A FILE OF ITS OWN, and that is the only reason this module exists.
 *
 * It used to live at the foot of `settings-utils.ts`, which is 648 lines of
 * plain default objects and string helpers — and `import { z } from "zod"` at
 * the top of that file put the whole of Zod into the client bundle of every
 * page that touched any of them.
 *
 * Measured: the storefront's FAQ page — a search box and a list — shipped 487
 * KB of blocking JavaScript, and the largest chunk in it, 285 KB raw,
 * contained Zod. The cart, the product page, the checkout and the filters
 * panel all import `defaultCommerceSettings` or `defaultModuleSettings` from
 * that file and nothing else; not one of them validates an email. The only
 * caller of the rule is the admin's Contact settings screen.
 *
 * So the rule moved rather than changing. It is the same `z.email()`, with
 * the same behaviour, in a module that only the one screen that needs it
 * pulls in.
 */
const emailRule = z.email();

export function isValidEmailAddress(value: string): boolean {
  return emailRule.safeParse(value.trim()).success;
}
