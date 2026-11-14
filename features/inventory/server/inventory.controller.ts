import { ok } from "@/lib/server/http/response";
import { withErrorHandler } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requirePermission } from "@/lib/server/auth/access";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./inventory.service";
import {
  adjustStockSchema,
  setUnlimitedSchema,
  inventorySettingsSchema,
} from "./inventory.validators";


export const adjustStockController = withErrorHandler(async (request: Request) => {
  const session = await requirePermission("inventory.manage");
  const input = validate(adjustStockSchema, await readJson(request));
  const result = await service.adjustStock(input, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(result, "Stock adjusted");
});

export const setUnlimitedController = withErrorHandler(async (request: Request) => {
  const session = await requirePermission("inventory.manage");
  const input = validate(setUnlimitedSchema, await readJson(request));
  const result = await service.setUnlimited(input, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(result, "Unlimited stock updated");
});

export const historyController = withErrorHandler(async (request: Request) => {
  await requirePermission("inventory.view");
  const cakeId = new URL(request.url).searchParams.get("cakeId") ?? undefined;
  return ok(await service.getHistory(cakeId), "Stock history");
});

export const overviewController = withErrorHandler(async () => {
  await requirePermission("inventory.view");
  return ok(await service.getOverview(), "Inventory overview");
});

export const getSettingsController = withErrorHandler(async () => {
  await requirePermission("inventory.view");
  return ok(await service.getSettings(), "Inventory settings");
});

export const updateSettingsController = withErrorHandler(async (request: Request) => {
  const session = await requirePermission("inventory.manage");
  const input = validate(inventorySettingsSchema, await readJson(request));
  const result = await service.updateSettings(input, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(result, "Inventory settings saved");
});
