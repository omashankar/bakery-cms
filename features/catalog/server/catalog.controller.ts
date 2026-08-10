import { ok } from "@/lib/server/http/response";
import { withErrorHandler, NotFoundError } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requireRole } from "@/lib/server/auth/dal";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./catalog.service";
import { catalogSectionSchemas, type CatalogSection } from "./catalog.validators";
import { allowlisted } from "@/lib/server/http/allowlist";

const CATALOG_ROLES = ["owner", "admin"] as const;

type SectionContext = { params: Promise<{ section: string }> };

export const getCatalogController = withErrorHandler(async () => {
  // Public — the storefront needs categories/flavours to render filters.
  return ok(await service.getCatalog(), "Catalog");
});

export const updateCatalogSectionController = withErrorHandler(
  async (request: Request, context: SectionContext) => {
    const session = await requireRole(...CATALOG_ROLES);
    const { section } = await context.params;

    // Checked on the OWN keys before indexing: a bare lookup resolves
    // `constructor` and `toString` off the prototype chain, so both were
    // truthy, walked past this guard, and handed `validate()` something with
    // no `safeParse` — a masked 500 where a 404 was the answer. Same fix as
    // the settings controller.
    const schema = allowlisted(catalogSectionSchemas, section);
    if (!schema) throw new NotFoundError("Unknown catalog section");

    const value = validate(schema, await readJson(request));
    const ctx = requestContext(request);
    const updated = await service.updateSection(section, value, {
      ...ctx,
      actorId: session.sub,
      actorEmail: session.email,
    });
    return ok(updated, "Catalog updated");
  },
);

export const resetCatalogSectionController = withErrorHandler(
  async (request: Request, context: SectionContext) => {
    const session = await requireRole(...CATALOG_ROLES);
    const { section } = await context.params;
    const ctx = requestContext(request);
    const updated = await service.resetSection(section, {
      ...ctx,
      actorId: session.sub,
      actorEmail: session.email,
    });
    return ok(updated, "Catalog reset");
  },
);
