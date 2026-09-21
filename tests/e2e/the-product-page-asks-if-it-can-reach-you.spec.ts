import { expect, test } from "@playwright/test";

/**
 * CAN IT REACH ME, ASKED WHERE THE CUSTOMER IS DECIDING.
 *
 * The shop asked for this by pointing at the storefront it is drawn from, where
 * the row sits between the personalisation and Add to Cart. The question it
 * answers is the last one before somebody commits: a customer who adds to cart,
 * fills in a delivery address and is told at checkout that no zone covers their
 * PIN code has spent five minutes to be turned away.
 *
 * EVERY WORD IT PRINTS IS THE SHOP'S OWN, and that is what this checks. The
 * zone's name, its minimum days and its charge are read off the record, so the
 * test reads the same record from the API and compares — a row that printed a
 * plausible sentence of its own would pass a test that only looked for text.
 *
 * AND THE MISS IS CHECKED AS CAREFULLY AS THE HIT. "No delivery area covers
 * this PIN code yet" is a fact about the zone list. "We do not deliver to you"
 * is a claim about the shop, and a shop that takes that order over the phone
 * would be calling itself a liar on its own product page.
 */

const BOX = 'input[aria-label="PIN code"]';

async function zonesOf(request: import("@playwright/test").APIRequestContext) {
  const answer = await request.get("/api/delivery-zones");
  const body = (await answer.json()) as { data?: unknown; zones?: unknown };
  const rows = (body.data ?? body.zones ?? body) as {
    name?: string;
    pincode?: string;
    isActive?: boolean;
    deliveryCharge?: number;
    minDeliveryDays?: number;
  }[];
  return Array.isArray(rows) ? rows : [];
}

async function aProduct(page: import("@playwright/test").Page) {
  await page.goto("/store/collections");
  await page.waitForTimeout(1800);
  const href = await page.evaluate(
    () => document.querySelector('a[href^="/store/cakes/"]')?.getAttribute("href") ?? "",
  );
  expect(href, "this shop has no product to open").not.toBe("");
  return href;
}

test("the product page answers a PIN code in the shop's own words", async ({ page, request }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });

  const zones = await zonesOf(request);
  const zone = zones.find((row) => row.isActive !== false && row.pincode);
  if (!zone) {
    /*
      A SKIP THAT SAYS WHY. The row is supposed to render nothing for a shop
      with no zones, so there is genuinely nothing to assert here — but the
      reason is printed rather than silent, because "0 zones" and "the control
      is broken" look identical in a green run.
    */
    test.skip(true, "this shop has no active zone with a PIN code to look up");
    return;
  }

  await page.goto(await aProduct(page));
  await page.waitForTimeout(3000);

  await expect(page.locator(BOX), "the product page has no delivery check").toBeVisible();

  /*
    ONE CONTROL, NOT TWO BOXES WITH A GAP — which the shop asked for twice,
    pointing at its reference both times. Measured rather than read off classes:
    the button touches the field, and it sits flush with the group's own right
    edge, which a bordered button floating beside a bordered input cannot do.
  */
  const joined = await page.evaluate((sel) => {
    const input = document.querySelector(sel);
    const form = input?.closest("form");
    const button = form?.querySelector('button[type="submit"]');
    if (!input || !form || !button) return null;
    const f = form.getBoundingClientRect();
    const i = input.getBoundingClientRect();
    const b = button.getBoundingClientRect();
    return {
      between: Math.round(b.left - i.right),
      flushRight: Math.round(f.right - b.right),
      sameHeight: Math.abs(f.height - b.height) <= 2,
    };
  }, BOX);

  expect(joined, "the delivery check has no submit button").not.toBeNull();
  expect(
    joined!.between,
    `there are ${joined!.between}px between the field and Check`,
  ).toBeLessThanOrEqual(1);
  expect(joined!.flushRight, "Check does not sit flush in the control").toBeLessThanOrEqual(2);
  expect(joined!.sameHeight, "Check is not the full height of the control").toBe(true);

  /* ---- a code the shop covers ------------------------------------------ */
  await page.fill(BOX, zone.pincode!);
  await page.click(`form:has(${BOX}) button[type="submit"]`);
  await page.waitForTimeout(900);

  const answer = await page.evaluate((sel) => {
    const form = document.querySelector(sel)?.closest("form");
    return (form?.parentElement?.textContent ?? "").replace(/\s+/g, " ").trim();
  }, BOX);

  expect(answer, `nothing was said about ${zone.pincode}`).toContain("Deliver");
  expect(
    answer,
    `the answer does not name the zone the shop matched: ${answer}`,
  ).toContain(zone.name!);

  if (Number.isFinite(zone.deliveryCharge) && (zone.deliveryCharge ?? 0) > 0) {
    expect(
      answer.replace(/,/g, ""),
      `the charge shown is not the zone's own ₹${zone.deliveryCharge}`,
    ).toContain(String(zone.deliveryCharge));
  }

  /* ---- and one it does not --------------------------------------------- */
  await page.fill(BOX, "999999");
  await page.click(`form:has(${BOX}) button[type="submit"]`);
  await page.waitForTimeout(900);

  const miss = await page.evaluate((sel) => {
    const form = document.querySelector(sel)?.closest("form");
    return (form?.parentElement?.textContent ?? "").replace(/\s+/g, " ").trim();
  }, BOX);

  expect(miss, "an uncovered code still reads as covered").not.toContain("Deliver");
  expect(miss, "nothing at all was said about an uncovered code").toContain(
    "No delivery area covers this PIN code",
  );
  /*
    The claim the wording exists to avoid. Checked by its shape rather than by
    one sentence, so a rewrite that means the same thing still fails.
  */
  expect(miss.toLowerCase()).not.toMatch(/we (do not|don't|cannot|can't) deliver/);
});

test("and what was checked there is what the header already knows", async ({ page, request }) => {
  /*
    ONE SAVED LOCATION, not two. A customer who checks a code on a product and
    then sees "Delivery location" still empty in the header has been asked the
    same question twice by the same shop — and the header's is the one that
    carries to checkout.
  */
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });

  const zones = await zonesOf(request);
  const zone = zones.find((row) => row.isActive !== false && row.pincode && row.name);
  if (!zone) {
    test.skip(true, "this shop has no named active zone to check against");
    return;
  }

  await page.goto(await aProduct(page));
  await page.waitForTimeout(3000);
  await page.fill(BOX, zone.pincode!);
  await page.click(`form:has(${BOX}) button[type="submit"]`);
  await page.waitForTimeout(900);

  await page.goto("/store");
  await page.waitForTimeout(2500);

  const pill = await page
    .locator("header button", { hasText: /deliver/i })
    .first()
    .innerText();
  expect(
    pill,
    `the header still says "${pill}" after a code was checked on a product`,
  ).toContain(zone.name!);
});
