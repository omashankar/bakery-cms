import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { NotFoundError } from "@/lib/server/http/errors";
import * as productRepo from "@/features/products/server/product.repository";
import { deriveStockStatus } from "@/apps/admin/commerce/lib/inventory-utils";
import type { InventorySettings } from "@/types/inventory";

import * as repo from "./inventory.repository";
import type { AdjustStockInput, SetUnlimitedInput, InventorySettingsInput } from "./inventory.validators";

interface RequestCtx {
  ip: string;
  userAgent: string;
  actorId?: string | null;
  actorEmail?: string;
}

export async function getSettings(): Promise<InventorySettings> {
  const doc = await repo.getOrCreateSettings();
  const json = doc.toJSON() as Record<string, unknown>;
  return {
    defaultLowStockThreshold: (json.defaultLowStockThreshold as number) ?? 10,
    trackStockHistory: (json.trackStockHistory as boolean) ?? true,
  };
}

export async function updateSettings(input: InventorySettingsInput, ctx: RequestCtx) {
  await repo.updateSettings(input);
  await writeAuditLog({
    action: "inventory.settings.update",
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "inventory", id: "settings" },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return getSettings();
}

export function getHistory(cakeId?: string) {
  return repo.listHistory(cakeId);
}

/** Adjust a product's stock (add/remove/set) and log the change. */
export async function adjustStock(input: AdjustStockInput, ctx: RequestCtx) {
  const product = await productRepo.findById(input.cakeId);
  if (!product) throw new NotFoundError("Product not found");

  const settings = await getSettings();
  const before = product.stockQuantity ?? 0;
  const qty = Math.max(input.quantity, 0);

  let after = before;
  if (input.type === "add") after = before + qty;
  else if (input.type === "remove") after = Math.max(before - qty, 0);
  else after = qty; // set

  const stockStatus = deriveStockStatus(
    { stockQuantity: after, unlimitedStock: false, lowStockThreshold: product.lowStockThreshold },
    settings,
  );

  const updated = await productRepo.patchFields(input.cakeId, {
    stockQuantity: after,
    unlimitedStock: false,
    stockStatus,
  });

  if (settings.trackStockHistory) {
    await repo.appendHistory({
      cakeId: product.id,
      cakeName: product.name,
      adjustmentType: input.type,
      quantityBefore: before,
      quantityChange: after - before,
      quantityAfter: after,
      reason: input.reason,
      note: input.note,
    });
  }

  await writeAuditLog({
    action: "inventory.adjust",
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "product", id: input.cakeId },
    metadata: { type: input.type, before, after, reason: input.reason },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return {
    cakeId: input.cakeId,
    stockQuantity: updated?.stockQuantity ?? after,
    unlimitedStock: false,
    stockStatus,
    updatedAt: updated?.updatedAt,
  };
}

/** Toggle unlimited stock for a product. */
export async function setUnlimited(input: SetUnlimitedInput, ctx: RequestCtx) {
  const product = await productRepo.findById(input.cakeId);
  if (!product) throw new NotFoundError("Product not found");

  const settings = await getSettings();
  const stockStatus = deriveStockStatus(
    {
      stockQuantity: product.stockQuantity ?? 0,
      unlimitedStock: input.unlimited,
      lowStockThreshold: product.lowStockThreshold,
    },
    settings,
  );

  const updated = await productRepo.patchFields(input.cakeId, {
    unlimitedStock: input.unlimited,
    stockStatus,
  });

  await writeAuditLog({
    action: "inventory.set_unlimited",
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "product", id: input.cakeId },
    metadata: { unlimited: input.unlimited },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return {
    cakeId: input.cakeId,
    stockQuantity: updated?.stockQuantity ?? product.stockQuantity ?? 0,
    unlimitedStock: input.unlimited,
    stockStatus,
    updatedAt: updated?.updatedAt,
  };
}

/** Aggregate stock overview across all products. */
export async function getOverview() {
  const [products, settings] = await Promise.all([productRepo.listAll(), getSettings()]);

  let inStock = 0;
  let lowStock = 0;
  let outOfStock = 0;
  let unlimited = 0;
  let totalUnits = 0;

  for (const p of products) {
    if (p.unlimitedStock) {
      unlimited += 1;
      continue;
    }
    totalUnits += p.stockQuantity ?? 0;
    const status = deriveStockStatus(
      { stockQuantity: p.stockQuantity, unlimitedStock: false, lowStockThreshold: p.lowStockThreshold },
      settings,
    );
    if (status === "low_stock") lowStock += 1;
    else if (status === "out_of_stock") outOfStock += 1;
    else inStock += 1;
  }

  return {
    totalSkus: products.length,
    inStock,
    lowStock,
    outOfStock,
    unlimited,
    alertCount: lowStock + outOfStock,
    totalUnits,
  };
}
