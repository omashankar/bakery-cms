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

    return {
      address: contact.address || defaultContact.address,
      phone: contact.phone || defaultContact.phone,
      email: contact.email || defaultContact.email,
      mapEmbedUrl: resolveMapEmbedUrl(contact.mapEmbedUrl),
      businessHours: contact.businessHours?.length ? contact.businessHours : defaultHours,
    };
  } catch {
    return fallbackContact();
  }
}
