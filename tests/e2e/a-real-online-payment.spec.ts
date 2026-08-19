import { expect, test } from "@playwright/test";

import { probeEmail, signInAsCustomer } from "./sign-in";

/**
 * A payment carried all the way through Razorpay, on a test key.
 *
 * `online-payment-is-offered.spec.ts` stops at the moment the payment window
 * opens, which is where a fast, stable check has to stop: everything past that
 * point is a third party's UI, and this one crosses four of its screens —
 * card entry, a save-card offer, the bank's OTP page, and the redirect back.
 *
 * But the part it stops before is the part that takes the money and creates the
 * order: `/api/razorpay/verify` checks the signature, and only then is the
 * order placed and the stock reduced. Nothing else in this suite covers that,
 * and it is the single most expensive thing in the shop to have quietly broken.
 *
 * OPT-IN, because it is slow (~2 minutes) and because Razorpay's screens are
 * theirs to change: run it with `E2E_PAY=1 npx playwright test a-real-online`.
 * A skip you have to ask for is not the same as a test that cannot fail — when
 * it runs, it either takes a real payment or it fails.
 *
 * The card is Razorpay's documented DOMESTIC test card. The obvious
 * `4111 1111 1111 1111` is treated as international and this shop's account has
 * international payments off, so it comes back "Payment could not be completed"
 * — a true answer to a question nobody meant to ask.
 *
 * The order it places is removed by the suite's own teardown, which restores
 * the shop to its pre-run snapshot.
 */
const DOMESTIC_TEST_CARD = "5267318187975449";
const TEST_OTP = "1234";

test.describe("paying for real, on a test key", () => {
  test.skip(
    process.env.E2E_PAY !== "1",
    "opt-in: set E2E_PAY=1 to drive a real Razorpay payment",
  );

  test("places the order and lands on the confirmation", async ({ page }) => {
    test.setTimeout(240_000);

    const available = await page.request.get("/api/razorpay/availability");
    const status = (await available.json()) as { configured?: boolean; testMode?: boolean };
    test.skip(!status.configured, "this shop has no Razorpay keys");
    expect(status.testMode, "REFUSING to drive a payment against LIVE keys").toBe(true);

    const customerEmail = await probeEmail("realpay");
    await signInAsCustomer(page, customerEmail);

    await page.goto("/store");
    const href = await page.locator('a[href^="/store/cakes/"]').first().getAttribute("href");
    expect(href, "the storefront lists no product to buy").toBeTruthy();
    await page.goto(href!);
    await page.getByRole("button", { name: /add to cart/i }).first().click();

    await page.goto("/store/cart");
    await page.getByRole("button", { name: /proceed to checkout/i }).click();

    await page.getByLabel(/full name/i).fill("E2E Pay Probe");
    await page.getByLabel(/email/i).fill(customerEmail);
    await page.getByLabel(/phone/i).fill("9000000002");
    await page.getByLabel(/address line 1|address/i).first().fill("2 Probe Lane");
    await page.getByLabel(/city/i).fill("Mumbai");
    await page.getByLabel(/state/i).fill("MH");
    await page.getByLabel(/PIN code/i).fill("400001");

    const earliest = new Date();
    earliest.setDate(earliest.getDate() + 5);
    await page
      .getByLabel(/delivery date/i)
      .fill(
        [
          earliest.getFullYear(),
          String(earliest.getMonth() + 1).padStart(2, "0"),
          String(earliest.getDate()).padStart(2, "0"),
        ].join("-"),
      );
    const slot = page.getByLabel(/delivery time/i);
    const options = await slot.locator("option").allTextContents();
    const firstReal = options.find((text) => text && !/select a time/i.test(text));
    if (firstReal) await slot.selectOption({ label: firstReal });
    await page.getByRole("button", { name: /continue|next/i }).first().click();

    await page.getByText(/pay online/i).first().click();
    await page.getByRole("button", { name: /continue|next|review/i }).first().click();
    await page
      .getByRole("button", { name: /^(pay\b|place order)/i })
      .filter({ hasNotText: /go back|edit/i })
      .first()
      .click();

    // ---- Razorpay's window ----
    const rz = page.frameLocator('iframe[src*="razorpay"]').first();
    const number = rz.getByRole("textbox", { name: /card number/i });
    await expect(number, "the payment window never opened").toBeVisible({ timeout: 45_000 });

    /**
     * Typed, not filled.
     *
     * These inputs format as the digits arrive and ignore a value set on them,
     * so `fill()` left the form empty, Continue stayed on the card screen, and
     * the run looked like a gateway failure.
     */
    await number.click();
    await number.pressSequentially(DOMESTIC_TEST_CARD, { delay: 60 });
    const expiry = rz.getByRole("textbox", { name: /MM \/ YY/i });
    await expiry.click();
    await expiry.pressSequentially("1230", { delay: 60 });
    const cvv = rz.getByRole("textbox", { name: /CVV/i });
    await cvv.click();
    await cvv.pressSequentially("123", { delay: 60 });
    await rz.getByRole("button", { name: /^continue$/i }).first().click();

    /**
     * Then whatever Razorpay puts in the way, until the shop's own page answers.
     *
     * Written as a loop over what is ON SCREEN rather than a fixed sequence:
     * the save-card offer is shown at Razorpay's discretion, and the OTP page
     * belongs to the card's bank. A scripted click-by-click order breaks the
     * first time either of them changes its mind.
     */
    for (let step = 0; step < 14; step += 1) {
      if (/\/store\/order\/success/.test(page.url())) break;
      await page.waitForTimeout(5000);

      const shown = await page
        .locator('iframe[src*="razorpay"]')
        .first()
        .contentFrame()
        ?.locator("body")
        .innerText()
        .catch(() => "");

      if (!shown) continue;

      if (/Enter OTP/i.test(shown)) {
        const otp = rz.getByRole("textbox").last();
        await otp.click().catch(() => undefined);
        await otp.pressSequentially(TEST_OTP, { delay: 80 }).catch(() => undefined);
        await rz
          .getByRole("button", { name: /^continue$/i })
          .last()
          .click()
          .catch(() => undefined);
        continue;
      }

      const offer = rz.getByRole("button", { name: /maybe later|skip/i }).first();
      if (await offer.isVisible().catch(() => false)) {
        await offer.click().catch(() => undefined);
      }
    }

    // ---- the shop's own answer ----
    await page.waitForURL(/\/store\/order\/success/, { timeout: 60_000 });

    const placed = new URL(page.url()).searchParams.get("order");
    expect(placed, "the confirmation page names no order").toBeTruthy();

    await expect(
      page.getByText(/order confirmed/i).first(),
      "the payment went through and the shop did not confirm it",
    ).toBeVisible();

    // The cart has to be empty afterwards. A paid order whose cart survives is
    // how the same cake gets bought twice.
    await page.goto("/store/cart");
    await expect(
      page.getByRole("button", { name: /remove item/i }),
      "the cart still holds the cake that was just paid for",
    ).toHaveCount(0);
  });
});
