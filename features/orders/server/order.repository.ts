import mongoose from "mongoose";

import { connectDB } from "@/lib/server/db/mongoose";
import { OrderModel, type OrderDoc } from "@/lib/server/db/models/order.model";
import { ProductModel } from "@/lib/server/db/models/product.model";
import type { PlacedOrder } from "@/features/orders/lib/orders";

/** Order repository — the only place that touches the orders collection. */

type Raw = OrderDoc & { __v?: number };

function toDoc(order: PlacedOrder): OrderDoc {
  const { id, ...rest } = order;
  return { _id: id, ...rest } as OrderDoc;
}

function toOrder(raw: Raw): PlacedOrder {
  const { _id, __v, ...rest } = raw as Record<string, unknown>;
  void __v;
  return { ...rest, id: String(_id) } as PlacedOrder;
}

export interface StockReduction {
  slug: string;
  quantity: number;
}

/**
 * Place an order and reduce product stock ATOMICALLY. If any write fails the
 * whole thing rolls back — no order without its stock decrement, and no stock
 * decrement without its order. This is the flagship transactional path.
 * Unlimited-stock products are skipped by the filter.
 */
export async function createOrderWithStockReduction(
  order: PlacedOrder,
  reductions: StockReduction[],
): Promise<PlacedOrder> {
  await connectDB();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await OrderModel.create([toDoc(order)], { session });
      for (const r of reductions) {
        if (!r.slug || r.quantity <= 0) continue;
        await ProductModel.updateOne(
          { slug: r.slug, unlimitedStock: { $ne: true } },
          { $inc: { stockQuantity: -r.quantity } },
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }
  return order;
}

export async function findById(id: string): Promise<PlacedOrder | null> {
  await connectDB();
  const doc = (await OrderModel.findById(id).lean()) as unknown as Raw | null;
  return doc ? toOrder(doc) : null;
}

export async function findByNumber(orderNumber: string): Promise<PlacedOrder | null> {
  await connectDB();
  const doc = (await OrderModel.findOne({ orderNumber }).lean()) as unknown as Raw | null;
  return doc ? toOrder(doc) : null;
}

export async function findByCustomerEmail(email: string): Promise<PlacedOrder[]> {
  await connectDB();
  const docs = (await OrderModel.find({ "address.email": email.toLowerCase().trim() })
    .sort({ placedAt: -1 })
    .lean()) as unknown as Raw[];
  return docs.map(toOrder);
}

export async function listAll(limit = 500): Promise<PlacedOrder[]> {
  await connectDB();
  const docs = (await OrderModel.find().sort({ placedAt: -1 }).limit(limit).lean()) as unknown as Raw[];
  return docs.map(toOrder);
}

export async function patch(id: string, fields: Partial<PlacedOrder>): Promise<PlacedOrder | null> {
  await connectDB();
  const doc = (await OrderModel.findByIdAndUpdate(
    id,
    { $set: { ...fields, updatedAt: new Date().toISOString() } },
    { new: true },
  ).lean()) as unknown as Raw | null;
  return doc ? toOrder(doc) : null;
}

export async function orderNumberExists(orderNumber: string): Promise<boolean> {
  await connectDB();
  return (await OrderModel.exists({ orderNumber })) !== null;
}
