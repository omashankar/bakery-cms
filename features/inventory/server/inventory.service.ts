import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { NotFoundError } from "@/lib/server/http/errors";
import * as productRepo from "@/features/products/server/product.repository";
import { deriveStockStatus } from "@/features/inventory/lib/inventory-utils";
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

/**
 * Adjust a product's stock (add/remove/set) and log the change.
 *
 * The arithmetic happens in the database. It used to happen here — read the
 * quantity, add or subtract in JS, write the absolute result — so an order
 * placed between the read and the write was erased: the cakes left the shop and
 * the number went back to what the admin had been looking at. Order placement
 * uses `$inc` on that same field, so the two were racing on the one number a
 * shop cannot afford to get wrong.
 */
export async function adjustStock(input: AdjustStockInput, ctx: RequestCtx) {
  const settings = await getSettings();
  // Integers only. A fractional quantity produced a stock level like 4.5, which
  // no filter, badge or oversell check treats as a whole cake.
  const qty = Math.max(Math.trunc(input.quantity), 0);

  const applied = await productRepo.applyStockDelta(input.cakeId, input.type, qty);
  if (!applied) throw new NotFoundError("Product not found");

  const { before, after, product } = applied;

  const stockStatus = deriveStockStatus(
    { stockQuantity: after, unlimitedStock: false, lowStockThreshold: product.lowStockThreshold },
    settings,
  );
  await productRepo.setStockStatusFor(input.cakeId, after, stockStatus);
  const updated = await productRepo.findById(input.cakeId);

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
    // What the row actually holds, which may already differ from `after` if an
    // order landed while this ran. The caller renders this number, so handing
    // back the locally-computed one would show a figure that is not in the
    // database — and two admins adjusting at once would each see their own.
    stockQuantity: updated?.stockQuantity ?? after,
    unlimitedStock: false,
    stockStatus: updated?.stockStatus ?? stockStatus,
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

/**
 * Aggregate stock overview, over every product the shop can still sell.
 *
 * Archived products were counted. "3 cakes need restocking" then included ones
 * withdrawn from sale months ago, so the alert badge never cleared and the
 * numbers on the cards did not match anything an admin could act on.
 *
 * Drafts are counted in the totals — they are real stock on real shelves — but
 * not in the low/out-of-stock ALERTS, because nothing is being lost while a cake
 * is not yet on sale.
 */
export async function getOverview() {
  const [all, settings] = await Promise.all([productRepo.listAll(), getSettings()]);
  const products = all.filter((p) => p.status !== "archived");

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
    const onSale = p.status === "published";
    if (status === "low_stock") {
      if (onSale) lowStock += 1;
      else inStock += 1;
    } else if (status === "out_of_stock") {
      if (onSale) outOfStock += 1;
      else inStock += 1;
    } else inStock += 1;
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
