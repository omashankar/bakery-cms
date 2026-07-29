import { getSettings } from "@/features/settings/server/settings.service";
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
      mapEmbedUrl: contact.mapEmbedUrl || defaultContact.mapEmbedUrl,
      businessHours: contact.businessHours?.length ? contact.businessHours : defaultHours,
    };
  } catch {
    return fallbackContact();
  }
}
