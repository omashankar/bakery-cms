import { restoreShop } from "./shop-state";

/**
 * Put the shop back.
 *
 * Runs after the whole suite, pass or fail — a run that dies mid-checkout is
 * exactly when a half-placed order is left behind. What it removes is decided
 * by the ids recorded before the run, never by a query that matches the rows.
 */
export default async function globalTeardown() {
  const summary = await restoreShop();
  console.log(`\n[e2e] shop restored — ${summary}`);
}
