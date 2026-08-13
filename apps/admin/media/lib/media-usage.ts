import { loadBanners } from "@/features/content/lib/banners-repository";
import { loadProducts } from "@/features/products/lib/products-repository";
import { getAllProducts } from "@/features/products/lib/product-catalog";

export interface MediaUsageRef {
  label: string;
  context: string;
}

/**
 * Where a media file is referenced, so the library can say whether deleting it
 * will break something.
 *
 * This used to scan four localStorage keys — bakery-cms-homepage-draft,
 * -published and the wedding pair — for the builders. Those keys do not exist:
 * the page builders moved to MongoDB, and the browser stores that owned them are
 * gone. So every builder scan silently matched nothing, and it never looked at
 * CMS pages, testimonial avatars, the header logo, the footer or the SEO images
 * at all.
 *
 * The consequence was not a cosmetic miscount. A hero image an admin had just
 * chosen in the Homepage Builder was reported as "Not referenced in cakes,
 * banners, or builders yet", counted on the Unused card, selectable through the
 * Unused filter, and deleted — with Cloudinary configured, destroyed — while the
 * live homepage still pointed at it.
 *
 * The server-held stores are fetched once on entering the admin and searched as
 * text. `isUsageIndexReady` exists so that a caller about to DELETE can tell
 * "nothing references this" apart from "I have not looked yet".
 */

interface RemoteSource {
  label: string;
  context: string;
  haystack: string;
}

let remoteSources: RemoteSource[] = [];
let indexReady = false;

/**
 * Called by the admin's usage sync once the server documents are in.
 *
 * `complete` is what makes the index's answer trustworthy, and it used to be
 * assumed. The sync filters out any source whose GET failed and passed the
 * survivors, so ONE failed request — the homepage layout, say — left the index
 * "ready" while blind to every reference that document holds. A hero image used
 * on the live homepage then answered "not used anywhere": it appeared under the
 * Unused filter, and the delete dialog dropped its "Still checking where this is
 * used" caveat, because that caveat is gated on this very flag. With Cloudinary
 * configured, Confirm destroys the asset rather than delisting it, and the
 * homepage renders a broken image.
 *
 * A partial index is still worth holding — every reference in it is real, so it
 * can only ever say "in use", never wrongly say "unused" — but it may not claim
 * to be the whole picture.
 */
export function setRemoteUsageIndex(sources: RemoteSource[], complete: boolean): void {
  remoteSources = sources;
  indexReady = complete;
}

/** False until the server-held references have been loaded at least once. */
export function isUsageIndexReady(): boolean {
  return indexReady;
}

/** Test/reset helper. */
export function clearRemoteUsageIndex(): void {
  remoteSources = [];
  indexReady = false;
}

export function getMediaUsageDetails(url: string): MediaUsageRef[] {
  const refs: MediaUsageRef[] = [];
  const normalized = url.trim();
  if (!normalized) return refs;

  getAllProducts().forEach((cake) => {
    if (cake.image === normalized) {
      refs.push({ label: cake.name, context: "Storefront cake" });
    }
  });

  loadProducts().forEach((cake) => {
    if (cake.images.includes(normalized)) {
      refs.push({ label: cake.name, context: "Admin cake" });
    }
  });

  loadBanners().forEach((banner) => {
    if (banner.image === normalized) {
      refs.push({ label: banner.title, context: "Banner" });
    }
  });

  /*
   * The gallery no longer renders `galleryImages`.
   *
   * Being in that constant used to mean "the storefront gallery shows this",
   * so the usage index reported every shipped demo photo as in use. The
   * galleries read the shop's own `images` list now, which arrives through the
   * homepage- and wedding-section documents in `remoteSources` below — so a
   * demo photo the shop never used correctly reads as unused, and one it DID
   * pick is found by the same search that finds every other reference.
   *
   * Left in the media library itself: those are sample assets an admin can pick
   * from or delete, which is not the same as publishing them as the shop's work.
   */

  for (const source of remoteSources) {
    if (source.haystack.includes(normalized)) {
      refs.push({ label: source.label, context: source.context });
    }
  }

  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.context}:${ref.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function countMediaUsage(url: string): number {
  return getMediaUsageDetails(url).length;
}
