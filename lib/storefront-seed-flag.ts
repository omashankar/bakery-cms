/**
 * Whether this page's storefront caches were filled from the server with the
 * page (`StorefrontCacheSeed`). The root providers' syncs read it and skip
 * the requests that would only fetch the same answers again.
 *
 * Per page load, deliberately: a module variable, gone on a full reload, so a
 * load that had no seed — an admin's, or one whose server read failed — runs
 * the syncs exactly as before.
 */
let seeded = false;

export function markStorefrontSeeded(): void {
  seeded = true;
}

export function isStorefrontSeeded(): boolean {
  return seeded;
}
