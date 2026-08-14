import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultAppSettings } from "@/features/settings/lib/settings-utils";

/**
 * One payment switch sends the shop's WHOLE commerce section.
 *
 * Which methods are on lives inside `commerce`, and a section PUT is a
 * replace-all — so flipping Cash on Delivery also asserts the delivery fee, the
 * free-delivery threshold, the tax rate and label, gift wrap, the minimum order
 * value, the order-number prefix, the checkout terms and the delivery time
 * slots. `setGatewayEnabled` read that object SYNCHRONOUSLY and only then
 * awaited, so the payload was frozen before anything had been read from the
 * server. `updateStore` hydrates afterwards, but its own comment is explicit
 * about the limit: it protects the sections NOT in the patch, and "protecting
 * that one is the form's job". Every settings form does that job by staying
 * behind a skeleton; a Switch on the Gateways screen is not a form and did not.
 *
 * So the write had to refuse rather than race — the same shape
 * `readHydratedCoupons` already gave the identical mistake in coupons.
 */
async function freshModules() {
  vi.resetModules();
  const settings = await import("@/features/settings/lib/settings-repository");
  const gateways = await import("@/features/payments/lib/payment-gateway-settings");
  return { settings, gateways };
}

/** The shop's real commerce settings, as only the server has them. */
const REAL_COMMERCE = {
  ...defaultAppSettings.commerce,
  deliveryFee: 250,
  freeDeliveryThreshold: 5000,
  taxRate: 0.12,
  taxLabel: "GST (12%)",
  minOrderValue: 1200,
};

interface Recorder {
  puts: { section: string; value: unknown }[];
}

/** `hydrates` false is the login-form case: the read 401s and the gate stays shut. */
function mockServer({ hydrates }: { hydrates: boolean }): Recorder {
  const rec: Recorder = { puts: [] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (method === "PUT") {
        rec.puts.push({
          section: url.replace("/api/settings/", ""),
          value: JSON.parse(String(init?.body ?? "null")),
        });
        return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
      }
      if (!hydrates) {
        return { ok: false, status: 401, json: async () => ({ success: false, data: null }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { ...defaultAppSettings, commerce: REAL_COMMERCE },
        }),
      };
    }) as unknown as typeof fetch,
  );
  return rec;
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("switching a payment method on the Gateways screen", () => {
  it("sends nothing, and says so, when the server's commerce copy never arrived", async () => {
    const { gateways } = await freshModules();
    const rec = mockServer({ hydrates: false });

    const persisted = await gateways.setGatewayEnabled("cod", false);

    // Not a silent no-op: both call sites pass this straight to `reportWrite`,
    // which tells the admin the server refused rather than "Gateway disabled".
    expect(persisted).toBe(false);
    expect(rec.puts).toEqual([]);
  }, 20_000);

  it("keeps the shop's real commerce settings when it does send", async () => {
    const { gateways } = await freshModules();
    const rec = mockServer({ hydrates: true });

    const persisted = await gateways.setGatewayEnabled("cod", false);

    expect(persisted).toBe(true);
    const commerce = rec.puts.find((p) => p.section === "commerce");
    expect(commerce).toBeDefined();

    const sent = commerce!.value as typeof REAL_COMMERCE & {
      paymentMethods: Record<string, boolean>;
    };
    // The one bit the admin actually changed...
    expect(sent.paymentMethods.cod).toBe(false);
    // ...and nothing else. These are the fields a frozen pre-hydration copy
    // would have quietly reverted to the demo seed.
    expect(sent.deliveryFee).toBe(REAL_COMMERCE.deliveryFee);
    expect(sent.freeDeliveryThreshold).toBe(REAL_COMMERCE.freeDeliveryThreshold);
    expect(sent.taxRate).toBe(REAL_COMMERCE.taxRate);
    expect(sent.taxLabel).toBe(REAL_COMMERCE.taxLabel);
    expect(sent.minOrderValue).toBe(REAL_COMMERCE.minOrderValue);
    expect(sent.deliveryFee).not.toBe(defaultAppSettings.commerce.deliveryFee);
  }, 20_000);

  it("does not touch commerce at all for a gateway that is not a payment method", async () => {
    const { gateways } = await freshModules();
    const rec = mockServer({ hydrates: true });

    await gateways.setGatewayEnabled("stripe", true);

    expect(rec.puts.some((p) => p.section === "commerce")).toBe(false);
  }, 20_000);
});
