import { getSettings } from "@/features/settings/server/settings.service";
import {
  isValidMapEmbedUrl,
  normalizeMapEmbedUrl,
} from "@/features/settings/lib/settings-utils";
import {
  businessHours as defaultHours,
  contactInfo as defaultContact,
} from "@/constants/landing-data";

/**
 * Contact details for the storefront, read on the SERVER from MongoDB. Contact
 * and FAQ pages use this so their address / phone / email / hours / map render
 * the admin's real settings in the HTML — instead of the client settings repo,
 * which returns hardcoded defaults on the server and never updates (contact page
 * is a server component) or mismatches on hydration (faq page is client).
 */
export interface StorefrontContact {
  address: string;
  phone: string;
  email: string;
  mapEmbedUrl: string;
  businessHours: { day: string; hours: string }[];
}

/**
 * Decides what the contact page's map frame gets, on the READ path.
 *
 * Two things the write-side schema cannot do for an install that already exists:
 *
 * - It only constrains FUTURE writes. Anything stored under the old
 *   `z.string().trim().optional()` — Google's raw `<iframe …>` snippet, or a
 *   `javascript:` URL — is still in Mongo and still reaches `<iframe src>`. So
 *   it is normalised and checked here too, and dropped if it is neither.
 * - An admin who CLEARS the field means "no map". The old
 *   `contact.mapEmbedUrl || defaultContact.mapEmbedUrl` read that as "use the
 *   demo pin", so a bakery in Delhi that removed its map advertised an address
 *   in Mumbai. Empty now stays empty, and the page renders no frame at all.
 */
import { chosen, chosenList, hoursIdentity } from "./shipped-placeholder";

function resolveMapEmbedUrl(stored: string | undefined): string {
  if (stored === undefined) return defaultContact.mapEmbedUrl;

  const normalized = normalizeMapEmbedUrl(stored);
  if (!normalized) return "";
  return isValidMapEmbedUrl(normalized) ? normalized : "";
}

function fallbackContact(): StorefrontContact {
  return {
    address: defaultContact.address,
    phone: defaultContact.phone,
    email: defaultContact.email,
    mapEmbedUrl: defaultContact.mapEmbedUrl,
    businessHours: defaultHours,
  };
}

export async function getStorefrontContact(): Promise<StorefrontContact> {
  try {
    const settingsRaw = await getSettings();
    const settings = settingsRaw as unknown as Record<string, unknown>;
    const contact = (settings.contact ?? {}) as {
      address?: string;
      phone?: string;
      email?: string;
      mapEmbedUrl?: string;
      businessHours?: { day: string; hours: string }[];
    };

    /**
     * A CLEARED field means "we do not publish this", not "use the demo one".
     *
     * `contactSchema` stores a cleared field as `""`, and `""` is falsy — so
     * `contact.phone || defaultContact.phone` handed back the shipped
     * `+91 1800-123-4567`, which the contact page turns into a live `tel:` link
     * and the FAQ page prints as the way to reach this bakery. A home baker
     * with no landline, or a shop that only takes WhatsApp orders, was
     * advertising a number that is not theirs and cannot be answered.
     *
     * The function directly above this was rewritten for exactly this reason —
     * `resolveMapEmbedUrl`'s comment says "An admin who CLEARS the field means
     * 'no map' … Empty now stays empty" — and its three siblings on the next
     * three lines were left as they were. `chosen()` goes further than a blank
     * check, because a value still equal to the shipped placeholder was seeded
     * rather than chosen.
     *
     * `fallbackContact()` keeps the defaults, and should: that is the
     * database-unreachable path, where the shop's real details are unknown
     * rather than known to be empty.
     */
    return {
      address: chosen(contact.address, defaultContact.address),
      phone: chosen(contact.phone, defaultContact.phone),
      email: chosen(contact.email, defaultContact.email),
      mapEmbedUrl: resolveMapEmbedUrl(contact.mapEmbedUrl),
      // The last of the four siblings. `businessHours?.length ? … : defaultHours`
      // published "Monday – Saturday, 9:00 AM – 9:00 PM" as this bakery's own
      // hours — a claim a customer can act on and turn up to a shut door.
      businessHours: chosenList(contact.businessHours, defaultHours, hoursIdentity),
    };
  } catch {
    return fallbackContact();
  }
}
