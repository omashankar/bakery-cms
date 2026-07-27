import { ok } from "@/lib/server/http/response";
import { withErrorHandler, NotFoundError } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requireRole } from "@/lib/server/auth/dal";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./settings.service";
import { sectionSchemas, type SettingsSection } from "./settings.validators";

/** Roles allowed to read/write settings (owner + legacy admin). */
const SETTINGS_ROLES = ["owner", "admin"] as const;

type SectionContext = { params: Promise<{ section: string }> };

export const getSettingsController = withErrorHandler(async () => {
  await requireRole(...SETTINGS_ROLES);
  return ok(await service.getSettings(), "Settings");
});

export const getPublicSettingsController = withErrorHandler(async () => {
  // No auth — the storefront needs branding/labels/commerce config to render.
  return ok(await service.getPublicSettings(), "Public settings");
});

export const getLabelsController = withErrorHandler(async () => {
  return ok(await service.getLabels(), "Business labels");
});

export const updateSectionController = withErrorHandler(
  async (request: Request, context: SectionContext) => {
    const session = await requireRole(...SETTINGS_ROLES);
    const { section } = await context.params;

    const schema = sectionSchemas[section as SettingsSection];
    if (!schema) throw new NotFoundError("Unknown settings section");

    const value = validate(schema, await readJson(request));
    const ctx = requestContext(request);
    const updated = await service.updateSection(section, value, {
      ...ctx,
      actorId: session.sub,
      actorEmail: session.email,
    });
    return ok(updated, "Settings updated");
  },
);

export const resetSectionController = withErrorHandler(
  async (request: Request, context: SectionContext) => {
    const session = await requireRole(...SETTINGS_ROLES);
    const { section } = await context.params;
    const ctx = requestContext(request);
    const updated = await service.resetSection(section, {
      ...ctx,
      actorId: session.sub,
      actorEmail: session.email,
    });
    return ok(updated, "Settings reset");
  },
);
