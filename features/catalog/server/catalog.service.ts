import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { NotFoundError } from "@/lib/server/http/errors";
import {
  defaultCategories,
  defaultFlavours,
  defaultOccasions,
  defaultWeightOptions,
} from "@/features/catalog/lib/catalog-utils";

import * as repo from "./catalog.repository";

interface RequestCtx {
  ip: string;
  userAgent: string;
  actorId?: string | null;
  actorEmail?: string;
}

/** Per-section defaults, used by resetSection. */
const SECTION_DEFAULTS: Record<string, unknown> = {
  categories: defaultCategories,
  flavours: defaultFlavours,
  occasions: defaultOccasions,
  weights: defaultWeightOptions,
};

function toCatalog(json: Record<string, unknown>) {
  return {
    categories: json.categories ?? [],
    flavours: json.flavours ?? [],
    occasions: json.occasions ?? [],
    weights: json.weights ?? [],
    updatedAt: json.updatedAt,
  };
}

/** Full catalog — no secrets, so this doubles as the public read. */
export async function getCatalog() {
  const doc = await repo.getOrCreateCatalog();
  return toCatalog(doc.toJSON() as Record<string, unknown>);
}

export async function updateSection(section: string, value: unknown, ctx: RequestCtx) {
  const doc = await repo.updateSection(section, value);
  await writeAuditLog({
    action: `catalog.update.${section}`,
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "catalog", id: section },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return toCatalog(doc.toJSON() as Record<string, unknown>);
}

export async function resetSection(section: string, ctx: RequestCtx) {
  if (!(section in SECTION_DEFAULTS)) throw new NotFoundError("Unknown catalog section");
  const doc = await repo.updateSection(section, SECTION_DEFAULTS[section]);
  await writeAuditLog({
    action: `catalog.reset.${section}`,
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "catalog", id: section },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return toCatalog(doc.toJSON() as Record<string, unknown>);
}
