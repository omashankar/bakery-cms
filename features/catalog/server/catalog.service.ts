import { cache } from "react";

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

/**
 * Full catalog — no secrets, so this doubles as the public read. Read at most
 * ONCE per request.
 *
 * The homepage asks for the taxonomy three times over — the page itself, the
 * header’s category menu via `getStorefrontCategories`, and every product
 * mapping via `categoryNames()` in products-service — for one singleton.
 *
 * Reads only. `updateSection` and `resetSection` below still go through
 * `repo.getOrCreateCatalog()` and answer with the document they just saved.
 */
export const getCatalog = cache(async () => {
  const doc = await repo.getOrCreateCatalog();
  return toCatalog(doc.toJSON() as Record<string, unknown>);
});

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
  // `Object.hasOwn`, because `in` walks the prototype chain — the same defect,
  // in the same shape, as the settings reset beside it. `__proto__`,
  // `constructor` and `toString` all answered true, took a function into
  // `doc.set()`, and came back 200 "Catalog reset" with an audit row
  // (`catalog.reset.__proto__`) recording a reset that never happened.
  if (!Object.hasOwn(SECTION_DEFAULTS, section)) {
    throw new NotFoundError("Unknown catalog section");
  }
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
