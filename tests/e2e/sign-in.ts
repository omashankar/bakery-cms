import { expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";

import { connect } from "./shop-state";

/**
 * Signing a customer in, for tests, the way a customer does it.
 *
 * Seeding `bakery-cms-customer-session` in localStorage used to BE the
 * mechanism — the storefront had no server-side customer auth, so the browser
 * declaring itself signed in was the whole of it. That is exactly what changed:
 * the session now lives in an httpOnly cookie the browser cannot write, and
 * `syncCustomerSession` asks the server on every page, so a seeded key is
 * cleared within a round trip of being planted.
 *
 * So these tests sign in properly: request a code, read its hash out of the
 * database, recover the code, type it. Slower, and the only version that is
 * true.
 */

/** The code is stored hashed, so a test recovers it the only way anyone could. */
function crackCode(hash: string): string | null {
  for (let i = 0; i < 1_000_000; i += 1) {
    const candidate = String(i).padStart(6, "0");
    if (createHash("sha256").update(candidate).digest("hex") === hash) return candidate;
  }
  return null;
}

/**
 * A real, deliverable address for this run.
 *
 * The shop's own configured sender, plus-tagged. Sign-in refuses to claim a
 * code was sent when SMTP did not accept it, so a made-up domain would test the
 * refusal rather than the flow.
 */
export async function probeEmail(tag: string): Promise<string> {
  const db = await connect();
  const settings = await db.collection("settings").findOne({});
  const from = String(settings?.smtp?.fromEmail ?? "");
  expect(from, "no SMTP sender configured — customer sign-in cannot be tested").toBeTruthy();
  const [local, domain] = from.split("@");
  return `${local}+${tag}${Date.now()}@${domain}`.toLowerCase();
}

/**
 * Open the sign-in modal and fill the address, SCOPED TO THE DIALOG.
 *
 * The header's "Login" is a dropdown TRIGGER, not the button that opens the
 * modal — that one is inside the menu it opens. And an unscoped
 * `getByLabel(/email address/i)` matches the newsletter field in the footer,
 * which leaves the modal empty and its button disabled.
 */
export async function openSignIn(page: Page, email: string) {
  const trigger = page.getByRole("button", { name: "Login", exact: true }).first();
  // Waited for rather than assumed: the header renders from the cached session
  // first and corrects itself once the server answers, so straight after a
  // sign-out this button appears a moment after the navigation settles. A press
  // that lands in that gap opens nothing, and the failure reads as a missing
  // menu.
  await expect(trigger).toBeVisible({ timeout: 15_000 });

  const menu = page.getByRole("menu");
  await expect(async () => {
    await trigger.press("Enter");
    await expect(menu).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });

  await menu.getByRole("button", { name: /^login$/i }).click();

  const modal = page.getByRole("dialog");
  await expect(modal.getByRole("heading", { name: /sign in/i })).toBeVisible();
  await modal.getByLabel(/email address/i).fill(email);
  return modal;
}

/** Sign in end to end. Leaves the browser holding a real session cookie. */
export async function signInAsCustomer(page: Page, email: string): Promise<void> {
  await page.goto("/store");
  const modal = await openSignIn(page, email);
  await modal.getByRole("button", { name: /email me a code/i }).click();

  // Only advances once the SERVER says the email went out.
  await expect(page.getByText(/enter the 6-digit code/i)).toBeVisible({ timeout: 30_000 });

  const db = await connect();
  const row = await db.collection("customerlogincodes").findOne({ email });
  expect(row, "no code row was written").toBeTruthy();
  const code = crackCode(String(row!.codeHash));
  expect(code, "could not recover the emailed code").toBeTruthy();

  for (const [index, digit] of [...code!].entries()) {
    await modal.getByLabel(`Code digit ${index + 1}`).fill(digit);
  }
  await modal.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("button", { name: /'s account$/ })).toBeVisible({ timeout: 15_000 });
}

/** Remove the account and any codes this run created. By address, which is this run's own. */
export async function removeCustomer(email: string): Promise<void> {
  if (!email) return;
  const db = await connect();
  await db.collection("customeraccounts").deleteMany({ email });
  await db.collection("customerlogincodes").deleteMany({ email });
}
