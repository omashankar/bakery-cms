import { ok } from "@/lib/server/http/response";
import { withErrorHandler, ConflictError, NotFoundError } from "@/lib/server/http/errors";
import { StoreConflictError } from "@/lib/server/db/cms-store";
import { validate, readJson } from "@/lib/server/http/validate";
import { can, getActor, requirePermission } from "@/lib/server/auth/access";
import type { Permission } from "@/features/team/lib/permissions";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./content.service";
import { contentSchemas } from "./content.validators";
import { allowlisted } from "@/lib/server/http/allowlist";

/**
 * The permission that makes someone an EDITOR of each collection: they read the
 * whole stored list (switched-off banners, unapproved testimonials) and may save
 * it. Everyone else gets what a visitor gets.
 */
const EDITOR_OF: Record<string, Permission> = {
  banners: "banners.manage",
  testimonials: "testimonials.manage",
  faq: "faq.manage",
};

function editorPermission(key: string): Permission | null {
  return Object.hasOwn(EDITOR_OF, key) ? EDITOR_OF[key] : null;
}
type KeyContext = { params: Promise<{ key: string }> };

export const getContentController = withErrorHandler(async (_req: Request, ctx: KeyContext) => {
  // Public, because the storefront hydrates these three collections in the
  // browser — but a visitor gets only what a visitor may see. It used to return
  // the whole stored array: unapproved testimonials, unpublished FAQs, and
  // banners that were switched off, expired or scheduled, complete with the
  // launch time of a campaign the shop had not announced.
  const { key } = await ctx.params;
  const permission = editorPermission(key);
  const isStaff = permission !== null && can(await getActor(), permission);

  // The version travels in a header so the response body keeps its shape for
  // every existing reader, including the storefront hydration.
  const { version } = await service.getContentVersioned(key);
  const data = isStaff ? await service.getContent(key) : await service.getPublicContent(key);

  /**
   * Which of the two answers this is.
   *
   * The body alone cannot say. A visitor's list and a staff list have the same
   * shape, so the browser could not tell a complete collection from a filtered
   * one — and it cached both the same way, then composed a REPLACE-ALL write
   * from whatever it held. `ContentServerSync` runs from `app-providers`, which
   * wraps /login too, so an admin who signed in through the form hydrated while
   * anonymous, got the public subset, and marked the cache trustworthy. Signing
   * in is a soft navigation, so that `[]`-dep effect never ran again. Editing
   * one banner then PUT a list with every switched-off, scheduled and expired
   * banner missing, and the server deleted them — the same for unpublished FAQs
   * and unapproved testimonials. Green toast, no warning.
   *
   * A header rather than a body field, matching `X-Content-Version` beside it,
   * so every existing reader keeps working unchanged.
   */
  return ok(data, key, {
    headers: {
      "X-Content-Version": String(version),
      "X-Content-Scope": isStaff ? "full" : "public",
    },
  });
});

export const replaceContentController = withErrorHandler(async (request: Request, ctx: KeyContext) => {
  const { key } = await ctx.params;

  const schema = allowlisted(contentSchemas, key);
  const permission = editorPermission(key);
  if (!schema || !permission) throw new NotFoundError("Unknown content collection");
  const session = await requirePermission(permission);

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
