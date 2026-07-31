import { getSettings } from "@/features/settings/server/settings.service";
import {
  instagramHandleFromUrl,
  isSafeSocialUrl,
} from "@/features/settings/lib/settings-utils";

/**
 * The shop's Instagram profile, read on the SERVER from the Social settings.
 *
 * The homepage's Instagram Gallery section had its own hardcoded
 * `instagramHandle: "monginisofficial"` and `instagramUrl: "https://instagram.com"`,
 * so a shop that filled in its real Instagram under Settings → Social still
 * advertised the demo account across seven links and a "Follow @…" button.
 *
 * Read here rather than from the client settings repo for the reason the rest of
 * this page already does it: the homepage is a server component that fetches its
 * content up front so the HTML and the hydration pass render the same thing.
 * Reading localStorage inside the section would put the demo handle in the HTML
 * and swap it after hydration.
 */
export interface StorefrontInstagram {
  /** A profile URL that is safe to put in an `<a href>`. */
  url: string;
  /** The @handle, without the @. Empty when the URL carries no account name. */
  handle: string;
}

export async function getStorefrontInstagram(): Promise<StorefrontInstagram | null> {
  try {
    const settings = (await getSettings()) as unknown as Record<string, unknown>;
    const social = (Array.isArray(settings.social) ? settings.social : []) as {
      platform?: string;
      href?: string;
      isActive?: boolean;
    }[];

    const profile = social.find(
      (link) =>
        link.isActive &&
        link.platform === "Instagram" &&
        isSafeSocialUrl(link.href ?? "") &&
        // The bare domain is the shipped placeholder, not a shop's profile —
        // treating it as configured would just reinstate the old behaviour.
        instagramHandleFromUrl(link.href ?? "") !== "",
    );

    if (!profile?.href) return null;
    return { url: profile.href, handle: instagramHandleFromUrl(profile.href) };
  } catch {
    // A settings read failing is not a reason to fail the homepage; the section
    // falls back to whatever the builder content holds.
    return null;
  }
}
