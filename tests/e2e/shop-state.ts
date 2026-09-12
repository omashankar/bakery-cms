import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.join(process.cwd(), "package.json"));
 
const mongoose = require("mongoose") as typeof import("mongoose");

/**
 * These tests place REAL orders in the shop's own database, because that is the
 * only way to find out whether placing an order works.
 *
 * So every run records what existed before and puts it back after: orders are
 * removed BY THE IDS THEY CREATED, never by a query that matches them, and the
 * stock an order consumed is restored. Matching on a query is how a cleanup
 * once destroyed rows it had not made.
 *
 * The teardown runs even when a test fails halfway, which is exactly when a
 * half-placed order is most likely to be left behind.
 */
const SNAPSHOT_PATH = path.join(process.cwd(), "node_modules", ".cache", "e2e-shop-state.json");

export interface ShopSnapshot {
  orderIds: string[];
  auditIds: string[];
  /**
   * The checkout drafts the shop ALREADY had.
   *
   * Optional so an older snapshot file still loads — and when it is absent,
   * teardown deletes no drafts at all. That is the safe direction: a leftover
   * test draft is rubbish, a deleted customer draft is a lost order.
   */
  draftIds?: string[];
  stock: Record<string, number>;
  /**
   * Whether each product is marked out of stock.
   *
   * Separate from the quantity, and the storefront reads THIS one:
   * `inStock: cake.stockStatus !== "out_of_stock"`. A test that flips it and a
   * teardown that only restores quantities is a test that leaves the shop with
   * a product it will not sell.
   */
  stockStatus: Record<string, string>;
}

function readEnv(): Record<string, string> {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const at = line.indexOf("=");
        return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^["']|["']$/g, "")];
      }),
  );
}

export async function connect() {
  const uri = process.env.MONGODB_URI || readEnv().MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set — cannot snapshot the shop");
  if (mongoose.connection.readyState === 0) await mongoose.connect(uri);
  return mongoose.connection.db!;
}

export async function snapshotShop(): Promise<ShopSnapshot> {
  const db = await connect();

  const orders = await db.collection("orders").find({}, { projection: { _id: 1 } }).toArray();
  /**
   * Drafts the shop ALREADY had, so teardown can leave them alone.
   *
   * Teardown used to delete every draft created in the last six hours,
   * whoever created it — against a live shop that is up to six hours of real
   * customers' half-finished checkouts, destroyed by the test harness. This
   * file's own header states the opposite rule: remove what the run created,
   * never what a query matches.
   */
  const drafts = await db
    .collection("checkoutdrafts")
    .find({}, { projection: { _id: 1 } })
    .toArray();
  const audit = await db.collection("auditlogs").find({}, { projection: { _id: 1 } }).toArray();
  const products = await db
    .collection("products")
    .find({}, { projection: { _id: 1, stockQuantity: 1, stockStatus: 1 } })
    .toArray();

  const snapshot: ShopSnapshot = {
    orderIds: orders.map((o) => String(o._id)),
    auditIds: audit.map((a) => String(a._id)),
    draftIds: drafts.map((d) => String(d._id)),
    stock: Object.fromEntries(
      products.map((p) => [String(p._id), Number(p.stockQuantity ?? 0)]),
    ),
    stockStatus: Object.fromEntries(
      products.map((p) => [String(p._id), String(p.stockStatus ?? "in_stock")]),
    ),
  };

  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot));
  return snapshot;
}

export async function restoreShop(): Promise<string> {
  if (!fs.existsSync(SNAPSHOT_PATH)) return "no snapshot — nothing restored";
  const before = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8")) as ShopSnapshot;
  const db = await connect();

  const knownOrders = new Set(before.orderIds);
  const strayOrders = (
    await db.collection("orders").find({}, { projection: { _id: 1, orderNumber: 1 } }).toArray()
  ).filter((o) => !knownOrders.has(String(o._id)));
  if (strayOrders.length > 0) {
    await db.collection("orders").deleteMany({ _id: { $in: strayOrders.map((o) => o._id) } });
  }

  const knownAudit = new Set(before.auditIds);
  const strayAudit = (
    await db.collection("auditlogs").find({}, { projection: { _id: 1 } }).toArray()
  ).filter((a) => !knownAudit.has(String(a._id)));
  if (strayAudit.length > 0) {
    await db.collection("auditlogs").deleteMany({ _id: { $in: strayAudit.map((a) => a._id) } });
  }

  // Placing an order decrements stock, and deleting the order row does not put
  // it back.
  let restocked = 0;
  for (const [id, quantity] of Object.entries(before.stock)) {
    const result = await db
      .collection("products")
      .updateOne({ _id: id as never, stockQuantity: { $ne: quantity } }, { $set: { stockQuantity: quantity } });
    restocked += result.modifiedCount;
  }

  // And the flag the storefront actually reads. A test that marks a cake out of
  // stock to see what the card does must not leave it that way.
  let restatused = 0;
  for (const [id, status] of Object.entries(before.stockStatus ?? {})) {
    const result = await db
      .collection("products")
      .updateOne({ _id: id as never, stockStatus: { $ne: status } }, { $set: { stockStatus: status } });
    restatused += result.modifiedCount;
  }

  /**
   * The drafts THIS RUN created — by id, against the snapshot.
   *
   * This was `createdAt: { $gte: six hours ago }`, which on a live shop
   * deletes real customers' half-finished checkouts that have nothing to do
   * with the run. Probe cleanup deletes what the probe created; a query is
   * not a record of that.
   *
   * No snapshot key at all (an older snapshot file) deletes NOTHING, which
   * is the safe direction: a leftover test draft is rubbish, a deleted
   * customer draft is a lost order.
   */
  const knownDrafts = new Set(before.draftIds ?? []);
  const draftsRemoved = before.draftIds
    ? await db
        .collection("checkoutdrafts")
        .find({}, { projection: { _id: 1 } })
        .toArray()
        .then((rows) => rows.map((r) => r._id).filter((id) => !knownDrafts.has(String(id))))
        .then((ids) =>
          ids.length
            ? db
                .collection("checkoutdrafts")
                .deleteMany({ _id: { $in: ids } })
                .then((r) => r.deletedCount)
            : 0,
        )
        .catch(() => 0)
    : 0;

  /**
   * The session the fixture planted, taken back out.
   *
   * `adminSession` upserts a real `sessions` row and real `refreshtokens` rows
   * so the server treats the test as genuinely signed in. Nothing removed
   * them, so a run left a LIVE admin session behind — and the Security Center
   * lists it as an active device ("Browser on Desktop", 127.0.0.1) beside the
   * owner’s real ones, indistinguishable from an intruder, with a Revoke
   * button next to it. Every later run re-stamped its expiry, so it never aged
   * out either.
   *
   * Deleted BY ID, not by a query: the fixture owns exactly this session and
   * the tokens pointing at it, and nothing else here may be touched.
   */
  const fixtureSessionId = new mongoose.Types.ObjectId("000000000000000000000e2e");
  const fixtureTokens = await db
    .collection("refreshtokens")
    .deleteMany({ sessionId: fixtureSessionId })
    .then((r) => r.deletedCount)
    .catch(() => 0);
  const fixtureSessions = await db
    .collection("sessions")
    .deleteOne({ _id: fixtureSessionId })
    .then((r) => r.deletedCount)
    .catch(() => 0);

  await mongoose.disconnect();
  fs.rmSync(SNAPSHOT_PATH, { force: true });

  return [
    `orders removed: ${strayOrders.length}${strayOrders.length ? ` (${strayOrders.map((o) => o.orderNumber).join(", ")})` : ""}`,
    `audit rows removed: ${strayAudit.length}`,
    `products restocked: ${restocked}`,
    `stock flags restored: ${restatused}`,
    `checkout drafts removed: ${draftsRemoved}`,
    `fixture session removed: ${fixtureSessions} (+${fixtureTokens} token rows)`,
  ].join(" · ");
}
