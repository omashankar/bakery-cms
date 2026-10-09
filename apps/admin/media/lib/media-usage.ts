import { loadBanners } from "@/features/content/lib/banners-repository";
import { loadProducts, PRODUCTS_UPDATED_EVENT } from "@/features/products/lib/products-repository";
import { MEDIA_UPDATED_EVENT } from "./media-utils";
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

/**
 * The lists every lookup scans, read ONCE per synchronous pass.
 *
 * The library asks "is this file used?" for every file, several times per
 * render — the grid, the stats card, the Unused count, the filter — and each
 * ask re-read and re-parsed the product cache and the banners from
 * localStorage. With 30 files that was over a hundred full JSON parses per
 * render; on a throttled phone the Media screen blocked the main thread for
 * ~4s. The snapshot is dropped on the next microtask, so a later render (after
 * a save, a sync, an event) always reads fresh.
 */
let snapshot: {
  catalog: ReturnType<typeof getAllProducts>;
  products: ReturnType<typeof loadProducts>;
  banners: ReturnType<typeof loadBanners>;
} | null = null;

// A product or media write inside the same synchronous pass must not be read
// past: those dispatch their events synchronously, so drop the snapshot then.
// Registered on first use, not at import: media-utils imports this module, so a
// top-level read of its constant could run before it is initialised.
let listening = false;

function lists() {
  if (!listening && typeof window !== "undefined") {
    listening = true;
    for (const event of [PRODUCTS_UPDATED_EVENT, MEDIA_UPDATED_EVENT]) {
      window.addEventListener(event, () => {
        snapshot = null;
      });
    }
  }
  if (!snapshot) {
    snapshot = { catalog: getAllProducts(), products: loadProducts(), banners: loadBanners() };
    queueMicrotask(() => {
      snapshot = null;
    });
  }
  return snapshot;
}

export function getMediaUsageDetails(url: string): MediaUsageRef[] {
  const refs: MediaUsageRef[] = [];
  const normalized = url.trim();
  if (!normalized) return refs;
  const { catalog, products, banners } = lists();

  catalog.forEach((cake) => {
    if (cake.image === normalized) {
      // A stable KEY, not display text. What a shop calls its goods is a
      // setting, and this module has no way to read one — the panel that
      // renders `context` does. `countMediaUsage` only ever takes `.length`,
      // so keeping the wording out of here leaves it needing nothing.
      refs.push({ label: cake.name, context: "storefront-product" });
    }
  });

  products.forEach((cake) => {
    if (cake.images.includes(normalized)) {
      refs.push({ label: cake.name, context: "admin-product" });
    }
  });

  banners.forEach((banner) => {
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

  // The server's product list backs up this browser's cache, which can be a
  // session old. Named only when the cache did not already name the product,
  // so one product is not counted twice.
  const namedByCache = refs.some(
    (ref) => ref.context === "admin-product" || ref.context === "storefront-product",
  );
  for (const source of remoteSources) {
    if (source.context === "Products" && namedByCache) continue;
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
