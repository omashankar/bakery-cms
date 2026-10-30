import { ok } from "@/lib/server/http/response";
import { withErrorHandler } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requireAnyPermission } from "@/lib/server/auth/access";
import { requestContext } from "@/lib/server/audit/audit-log";
import type { Permission } from "@/features/team/lib/permissions";

import * as service from "./media.service";
import { mediaFilesPayloadSchema, mediaFoldersSchema, uploadSchema } from "./media.validators";

/**
 * Everyone whose own screens put pictures on the site: a product editor adds a
 * product photo, a content editor a banner. They upload through the library —
 * an upload is registered in it — so they must be able to ADD to it. Only
 * `media.manage` may rename, move or delete what is already there.
 */
export const MEDIA_CONTRIBUTORS: Permission[] = [
  "media.manage",
  "products.create",
  "products.update",
  "catalog.manage",
  "homepage.manage",
  "banners.manage",
  "testimonials.manage",
  "pages.manage",
  "settings.manage",
];

/** The picker shows the library to the same people, plus anyone who may view it. */
export const MEDIA_READERS: Permission[] = ["media.view", ...MEDIA_CONTRIBUTORS];

export const getFilesController = withErrorHandler(async () => {
  await requireAnyPermission(...MEDIA_READERS);
  return ok(await service.getFiles(), "Media files");
});

export const replaceFilesController = withErrorHandler(async (request: Request) => {
  const session = await requireAnyPermission(...MEDIA_CONTRIBUTORS);
  const payload = validate(mediaFilesPayloadSchema, await readJson(request));
  const files = Array.isArray(payload) ? payload : payload.files;
  const deletedIds = Array.isArray(payload) ? [] : payload.deletedIds;
  const ctx = {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  };
  // A contributor's write can only ADD. Whatever it says about files already in
  // the library — a rename, a move, an omission that a replace-all would read
  // as a deletion — is ignored, not refused, so an upload from a product form
  // holding a slightly stale copy of the library still lands.
  const result = session.permissions.has("media.manage")
    ? await service.replaceFiles(files as never, ctx, deletedIds)
    : await service.addFiles(files as never, ctx);
  return ok(result, "Media files saved");
});

export const getFoldersController = withErrorHandler(async () => {
  await requireAnyPermission(...MEDIA_READERS);
  return ok(await service.getFolders(), "Media folders");
});

export const replaceFoldersController = withErrorHandler(async (request: Request) => {
  const session = await requireAnyPermission("media.manage");
  const folders = validate(mediaFoldersSchema, await readJson(request));
  const result = await service.replaceFolders(folders as never, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(result, "Media folders saved");
});

export const uploadController = withErrorHandler(async (request: Request) => {
  await requireAnyPermission(...MEDIA_CONTRIBUTORS);
  const { source, folder } = validate(uploadSchema, await readJson(request));
  const result = await service.uploadMedia(source, folder);
  // Cloudinary not configured → { configured: false } so the client falls back
  // to storing the raw source (the pre-Cloudinary behaviour).
  return ok(result ?? { configured: false }, result ? "Uploaded" : "Cloudinary not configured");
});
