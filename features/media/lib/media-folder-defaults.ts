/**
 * The media library's built-in folders, and their ids.
 *
 * This used to sit in apps/admin/media/lib/media-folders.ts, next to the
 * localStorage CRUD that lists and renames them, because the admin's folder
 * sidebar was the first thing that needed them. But the built-in set is the
 * product's shipped data, not an admin screen:
 * features/media/server/media.service.ts seeds the Mongo "media-folders" store
 * from it, so a SERVER module had to import out of @/apps/admin to know what
 * folders a fresh shop starts with.
 *
 * Nothing here is browser code — the whole file depends on @/types/media and a
 * date. The persisting half stays behind in apps/admin, where the localStorage
 * key and the MEDIA_UPDATED_EVENT dispatch belong.
 *
 * nowIso() is deliberately duplicated rather than exported from here or
 * imported back: features/commerce/lib/invoice-defaults.ts, the module this one
 * is shaped after, carries its own copy for the same reason — a one-line date
 * call is not worth a public symbol on the domain surface.
 */

import type { MediaFolder } from "@/types/media";

export const UPLOADS_FOLDER_ID = "folder-uploads";
export const CAKES_FOLDER_ID = "folder-cakes";
export const BANNERS_FOLDER_ID = "folder-banners";
export const GALLERY_FOLDER_ID = "folder-gallery";

function nowIso(): string {
  return new Date().toISOString();
}

export const defaultMediaFolders: MediaFolder[] = [
  {
    id: CAKES_FOLDER_ID,
    // The id stays `folder-cakes` — it is referenced by stored media rows and
    // by `media-repository`, and renaming it would orphan them. Only the shown
    // name changes, and only for a shop that does not have this folder yet:
    // an existing one is already a row in Mongo with its old name.
    name: "Products",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: BANNERS_FOLDER_ID,
    name: "Banners & Offers",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: GALLERY_FOLDER_ID,
    name: "Gallery",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: UPLOADS_FOLDER_ID,
    name: "Uploads",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];
