import { contactInfo, businessHours as seededHours } from "@/constants/landing-data";
import { getSettings } from "@/features/settings/server/settings.service";
import type { ContactSettings } from "@/types/settings";

/**
 * The shop's real address and opening hours, read on the SERVER from Settings →
 * Contact.
 *
 * The homepage's Store Locator section did not look anything up. Its pincode
 * form waited 600ms and then toasted "Stores found — showing outlets near
 * 110001" without searching, and the three outlets beside it were a module
 * constant: Andheri West, Bandra and Powai, fixed at 1.2 / 3.5 / 6.8 km from
 * wherever the customer happened to be. A shop in Delhi ran a homepage that
 * confidently directed its customers to three Mumbai addresses.
 *
 * This CMS stores one address, one phone and one set of business hours — there
 * is no outlet list to search, and inventing a search over data that does not
 * exist is what produced the lie. So the section shows the shop, truthfully.
 *
 * Read on the server for the same reason the rest of this page is: reading
 * settings inside the client section would put placeholder text in the HTML and
 * swap it after hydration.
 */
export interface StorefrontLocation {
  address: string;
  phone: string;
  /** A Google Maps link built from the address — never an admin-supplied URL. */
  mapUrl: string;
  hours: { day: string; hours: string }[];
}

/**
 * The shipped placeholders count as "not set".
 *
 * Settings → Contact is never empty: the settings singleton is CREATED with
 * `defaultContactSettings`, which is `contactInfo` from landing-data — "123
 * Baker Street, Mumbai, Maharashtra 400001", a demo 1800 number and three demo
 * opening-hours rows. So an "is it filled in?" check can never fail, and a
 * bakery in Delhi that installs this CMS and never opens Settings would ship a
 * homepage panel headed "Visit Our Bakery" pointing at an address in Mumbai,
 * with a Get Directions button that opens Google Maps there. Replacing three
 * invented outlets with one invented outlet is not a fix.
 *
 * A value equal to the shipped placeholder was seeded, not chosen.
 */
function chosen(value: string | undefined, placeholder: string): string {
  const trimmed = value?.trim() ?? "";
  return trimmed && trimmed !== placeholder.trim() ? trimmed : "";
}

export async function getStorefrontLocation(): Promise<StorefrontLocation | null> {
  try {
    const settings = (await getSettings()) as { contact?: ContactSettings };
    const contact = settings.contact;

    const address = chosen(contact?.address, contactInfo.address);
    const phone = chosen(contact?.phone, contactInfo.phone);
    if (!address && !phone) return null;

    const storedHours = Array.isArray(contact?.businessHours) ? contact.businessHours : [];
    // The seeded rows go the same way, and only as a set: a shop that edited one
    // of them has chosen its hours, so all three are theirs.
    const hoursAreSeeded =
      storedHours.length === seededHours.length &&
      storedHours.every(
        (entry, index) =>
          entry?.day?.trim() === seededHours[index].day &&
          entry?.hours?.trim() === seededHours[index].hours
      );
    const hours = hoursAreSeeded
      ? []
      : storedHours
          .filter((entry) => entry?.day?.trim() && entry?.hours?.trim())
          .map((entry) => ({ day: entry.day.trim(), hours: entry.hours.trim() }));

    return {
      address,
      phone,
      // Built from the address rather than using `contact.mapEmbedUrl`: that is
      // admin-typed and would otherwise reach an href or an iframe src.
      mapUrl: address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
        : "",
      hours,
    };
  } catch {
    // A settings read failing is not a reason to fail the homepage.
    return null;
  }
}
