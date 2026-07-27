import { ok } from "@/lib/server/http/response";
import { withErrorHandler } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requireRole } from "@/lib/server/auth/dal";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./inventory.service";
import {
  adjustStockSchema,
  setUnlimitedSchema,
  inventorySettingsSchema,
} from "./inventory.validators";

const INVENTORY_ROLES = ["owner", "admin"] as const;

export const adjustStockController = withErrorHandler(async (request: Request) => {
  const session = await requireRole(...INVENTORY_ROLES);
  const input = validate(adjustStockSchema, await readJson(request));
  const result = await service.adjustStock(input, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(result, "Stock adjusted");
});

export const setUnlimitedController = withErrorHandler(async (request: Request) => {
  const session = await requireRole(...INVENTORY_ROLES);
  const input = validate(setUnlimitedSchema, await readJson(request));
  const result = await service.setUnlimited(input, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(result, "Unlimited stock updated");
});

export const historyController = withErrorHandler(async (request: Request) => {
  await requireRole(...INVENTORY_ROLES);
  const cakeId = new URL(request.url).searchParams.get("cakeId") ?? undefined;
  return ok(await service.getHistory(cakeId), "Stock history");
});

export const overviewController = withErrorHandler(async () => {
  await requireRole(...INVENTORY_ROLES);
  return ok(await service.getOverview(), "Inventory overview");
});

export const getSettingsController = withErrorHandler(async () => {
  await requireRole(...INVENTORY_ROLES);
  return ok(await service.getSettings(), "Inventory settings");
});

export const updateSettingsController = withErrorHandler(async (request: Request) => {
  const session = await requireRole(...INVENTORY_ROLES);
  const input = validate(inventorySettingsSchema, await readJson(request));
  const result = await service.updateSettings(input, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(result, "Inventory settings saved");
});
