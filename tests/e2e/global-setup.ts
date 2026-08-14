import { snapshotShop } from "./shop-state";

/**
 * Record what the shop looks like before anything is clicked.
 *
 * The teardown removes exactly what this run created, by id — so this has to
 * run first, and has to record ids rather than counts.
 */
export default async function globalSetup() {
  const before = await snapshotShop();
  console.log(
    `[e2e] shop snapshot — orders: ${before.orderIds.length}, audit rows: ${before.auditIds.length}, products: ${Object.keys(before.stock).length}`,
  );
}
