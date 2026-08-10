import { contactInfo, businessHours as seededHours } from "@/constants/landing-data";
import { getSettings } from "@/features/settings/server/settings.service";
import type { ContactSettings } from "@/types/settings";
import { chosen } from "./shipped-placeholder";

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
 * `settings` may be passed in by a caller that has already read it.
 *
 * The homepage was making three round trips to the same singleton document per
 * request — this helper, the Instagram helper, and the page itself for the
 * currency — each of which also runs the settings `migrate()` pass, so three of
 * those raced to repair and save the same document.
 */
export async function getStorefrontLocation(
  settings?: { contact?: ContactSettings },
): Promise<StorefrontLocation | null> {
  try {
    const resolved =
      settings ?? ((await getSettings()) as { contact?: ContactSettings });
    const contact = resolved.contact;

    const address = chosen(contact?.address, contactInfo.address);
    const phone = chosen(contact?.phone, contactInfo.phone);

    // The ADDRESS is what makes this section mean anything: it is headed "visit
    // us" and its job is to say where. A phone on its own produced a panel with
    // one tel: link under a heading promising directions — verified against the
    // running shop, whose settings hold the seeded Mumbai address and a real
    // phone number. Without a real address there is nothing truthful to show and
    // the section does not render.
    if (!address) return null;

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
