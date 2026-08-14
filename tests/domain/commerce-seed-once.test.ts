import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  path.join(process.cwd(), "features/commerce/server/commerce.repository.ts"),
  "utf8",
);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

function bodyOf(signature: string): string {
  const start = SOURCE.indexOf(signature);
  expect(start, `not found: ${signature}`).toBeGreaterThan(-1);
  const rest = SOURCE.slice(start);
  return stripComments(rest.slice(0, rest.indexOf("\n}")));
}

/**
 * "Empty" cannot tell a brand new shop from one that deliberately deleted
 * everything.
 *
 * Both collections in this file price live checkouts — `getCoupons` is what
 * `priceCart` resolves a code against, and the zones decide the delivery fee —
 * so a resurrected row is not a stale display value, it is money. The zones were
 * fixed for exactly this and the coupons beside them were not: clearing the
 * coupons brought WELCOME10 back on the next read, and it took 10% off a live
 * order. Verified against a running shop before the fix.
 *
 * Neither rule was pinned by a test, which is why the second one drifted.
 */
describe.each([
  {
    what: "coupons",
    fn: "export async function listCoupons(",
    replace: "export async function replaceCoupons(",
    key: "COUPONS_SEED_KEY",
    model: "CouponModel",
  },
  {
    what: "delivery zones",
    fn: "export async function listZones(",
    replace: "export async function replaceZones(",
    key: "ZONES_SEED_KEY",
    model: "DeliveryZoneModel",
  },
])("$what seed once, not whenever empty", ({ fn, replace, key, model }) => {
  it("checks the marker as well as the row count", () => {
    const body = bodyOf(fn);
    expect(body).toContain(`${model}.estimatedDocumentCount()`);
    expect(body).toContain(`!(await hasSeeded(${key}))`);
  });

  it("marks it seeded only after the insert succeeded", () => {
    // Marking outside the try records "already seeded" over a collection that
    // stayed empty after a transient write failure, and then no code path can
    // ever seed the shop.
    const body = bodyOf(fn);
    const insert = body.indexOf("insertMany");
    const mark = body.indexOf(`markSeeded(${key})`);
    const catchAt = body.indexOf("} catch");

    expect(insert).toBeGreaterThan(-1);
    expect(mark).toBeGreaterThan(insert);
    expect(mark).toBeLessThan(catchAt);
  });

  it("treats a deliberate write — including a write of none — as settling it", () => {
    // This is what makes "delete everything" stick.
    const body = bodyOf(replace);
    expect(body).toContain(`markSeeded(${key})`);
    expect(body.indexOf(`markSeeded(${key})`)).toBeLessThan(body.indexOf("bulkWrite"));
  });

  it("uses its own marker key", () => {
    // One shared key would let seeding either collection silence the other.
    expect(SOURCE).toMatch(new RegExp(`const ${key} = "[a-z-]+"`));
  });
});

it("the two collections do not share a seed marker", () => {
  const coupons = SOURCE.match(/const COUPONS_SEED_KEY = "([^"]+)"/)?.[1];
  const zones = SOURCE.match(/const ZONES_SEED_KEY = "([^"]+)"/)?.[1];

  expect(coupons).toBeTruthy();
  expect(zones).toBeTruthy();
  expect(coupons).not.toBe(zones);
});
