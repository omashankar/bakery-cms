import { ok } from "@/lib/server/http/response";
import { withErrorHandler, ConflictError, NotFoundError } from "@/lib/server/http/errors";
import { StoreConflictError } from "@/lib/server/db/cms-store";
import { validate, readJson } from "@/lib/server/http/validate";
import { getSession, requireRole } from "@/lib/server/auth/dal";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./content.service";
import { contentSchemas } from "./content.validators";
import { allowlisted } from "@/lib/server/http/allowlist";

const CONTENT_ROLES = ["owner", "admin"] as const;
type KeyContext = { params: Promise<{ key: string }> };

export const getContentController = withErrorHandler(async (_req: Request, ctx: KeyContext) => {
  // Public, because the storefront hydrates these three collections in the
  // browser — but a visitor gets only what a visitor may see. It used to return
  // the whole stored array: unapproved testimonials, unpublished FAQs, and
  // banners that were switched off, expired or scheduled, complete with the
  // launch time of a campaign the shop had not announced.
  const { key } = await ctx.params;
  const session = await getSession();
  const isStaff = Boolean(session && CONTENT_ROLES.includes(session.role as never));

  // The version travels in a header so the response body keeps its shape for
  // every existing reader, including the storefront hydration.
  const { version } = await service.getContentVersioned(key);
  const data = isStaff ? await service.getContent(key) : await service.getPublicContent(key);

  return ok(data, key, { headers: { "X-Content-Version": String(version) } });
});

export const replaceContentController = withErrorHandler(async (request: Request, ctx: KeyContext) => {
  const session = await requireRole(...CONTENT_ROLES);
  const { key } = await ctx.params;

  const schema = allowlisted(contentSchemas, key);
  if (!schema) throw new NotFoundError("Unknown content collection");

  const items = validate(schema, await readJson(request));
  const header = request.headers.get("X-Content-Version");
  const expectedVersion = header !== null && header !== "" ? Number(header) : undefined;

  try {
    const result = await service.replaceContent(
      key,
      items,
      {
        ...requestContext(request),
        actorId: session.sub,
        actorEmail: session.email,
      },
      Number.isFinite(expectedVersion) ? expectedVersion : undefined,
    );
    const { version } = await service.getContentVersioned(key);
    return ok(result, `${key} saved`, { headers: { "X-Content-Version": String(version) } });
  } catch (error) {
    if (error instanceof StoreConflictError) {
      throw new ConflictError(error.message);
    }
    throw error;
  }
});
