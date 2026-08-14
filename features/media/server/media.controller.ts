import { ok } from "@/lib/server/http/response";
import { withErrorHandler } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requireRole } from "@/lib/server/auth/dal";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./media.service";
import { mediaFilesPayloadSchema, mediaFoldersSchema, uploadSchema } from "./media.validators";

const MEDIA_ROLES = ["owner", "admin"] as const;

export const getFilesController = withErrorHandler(async () => {
  await requireRole(...MEDIA_ROLES);
  return ok(await service.getFiles(), "Media files");
});

export const replaceFilesController = withErrorHandler(async (request: Request) => {
  const session = await requireRole(...MEDIA_ROLES);
  const payload = validate(mediaFilesPayloadSchema, await readJson(request));
  const files = Array.isArray(payload) ? payload : payload.files;
  const deletedIds = Array.isArray(payload) ? [] : payload.deletedIds;
  const result = await service.replaceFiles(
    files as never,
    {
      ...requestContext(request),
      actorId: session.sub,
      actorEmail: session.email,
    },
    deletedIds,
  );
  return ok(result, "Media files saved");
});

export const getFoldersController = withErrorHandler(async () => {
  await requireRole(...MEDIA_ROLES);
  return ok(await service.getFolders(), "Media folders");
});

export const replaceFoldersController = withErrorHandler(async (request: Request) => {
  const session = await requireRole(...MEDIA_ROLES);
  const folders = validate(mediaFoldersSchema, await readJson(request));
  const result = await service.replaceFolders(folders as never, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(result, "Media folders saved");
});

export const uploadController = withErrorHandler(async (request: Request) => {
  await requireRole(...MEDIA_ROLES);
  const { source, folder } = validate(uploadSchema, await readJson(request));
  const result = await service.uploadMedia(source, folder);
  // Cloudinary not configured → { configured: false } so the client falls back
  // to storing the raw source (the pre-Cloudinary behaviour).
  return ok(result ?? { configured: false }, result ? "Uploaded" : "Cloudinary not configured");
});
