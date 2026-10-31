/**
 * A MEMBER CAN SAVE THE CONFIG THEIR ROLE ALLOWS.
 *
 * Four admin-config blobs — the owner's profile, the payment gateways, the
 * payment notification switches and the custom code — shared ONE hydration
 * gate, opened only when all four had been read. The profile is the owner's
 * alone, so for every other member that gate never opened: a manager given
 * "change payments", or a role given "change settings", had every save of the
 * gateways or the custom code refused as "saved on this device only".
 *
 * Now each blob has its own gate, opened by its own read, and the admin shell
 * asks only for the blobs the member may read.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_CONFIG_ACCESS, mayUseAdminConfigBlob } from "@/features/admin-config/lib/admin-config-rules";

type Answer = { status: number; data?: unknown };

function stubServer(answers: Record<string, Answer>) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    calls.push(`${method} ${path}`);
    if (method === "PUT") return new Response(JSON.stringify({ success: true, data: null }), { status: 200 });
    const key = Object.keys(answers).find((k) => path.endsWith(k));
    const answer = key ? answers[key] : { status: 404 };
    return new Response(JSON.stringify({ success: answer.status < 400, data: answer.data ?? null }), {
      status: answer.status,
    });
  });
  return calls;
}

async function freshModules() {
  vi.resetModules();
  const api = await import("@/features/admin-config/lib/admin-config-api");
  const hydration = await import("@/features/admin-config/lib/admin-config-hydration");
  return { ...api, ...hydration };
}

const EVERY_BLOB_BUT_THE_PROFILE: Record<string, Answer> = {
  "/api/admin-config/admin-profile": { status: 403 },
  "/api/admin-config/payment-gateways": { status: 200, data: {} },
  "/api/admin-config/payment-notif-prefs": { status: 200, data: {} },
  "/api/admin-config/custom-code": { status: 200, data: { css: "", js: "" } },
  "/api/auth/me": { status: 200, data: null },
};

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("each blob has its own gate", () => {
  it("a blob the member may not read keeps only ITS gate shut", async () => {
    stubServer(EVERY_BLOB_BUT_THE_PROFILE);
    const m = await freshModules();

    await expect(m.ensureAdminConfigHydrated()).resolves.toBe(false);

    expect(m.adminConfigGates["admin-profile"].hasSettled()).toBe(false);
    expect(m.adminConfigGates["payment-gateways"].hasSettled()).toBe(true);
    expect(m.adminConfigGates["payment-notif-prefs"].hasSettled()).toBe(true);
    expect(m.adminConfigGates["custom-code"].hasSettled()).toBe(true);
    // All four together is still the honest answer for a screen that needs all four.
    expect(m.adminConfigHydration.hasSettled()).toBe(false);
  });

  it("so a member who may change the gateways can save them", async () => {
    const calls = stubServer(EVERY_BLOB_BUT_THE_PROFILE);
    const m = await freshModules();
    await m.ensureAdminConfigHydrated();

    await expect(m.replacePaymentGatewaysRequest({})).resolves.toBe(true);
    await expect(m.replaceCustomCodeRequest({ css: "", js: "" })).resolves.toBe(true);
    expect(calls).toContain("PUT /api/admin-config/payment-gateways");
    expect(calls).toContain("PUT /api/admin-config/custom-code");
  });

  it("a gate never opens on another blob's read", async () => {
    stubServer({ ...EVERY_BLOB_BUT_THE_PROFILE, "/api/admin-config/custom-code": { status: 500 } });
    const m = await freshModules();
    await m.ensureAdminConfigHydrated();

    expect(m.adminConfigGates["custom-code"].hasSettled()).toBe(false);
    expect(m.adminConfigGates["payment-gateways"].hasSettled()).toBe(true);
  });

  it("asks only for the blobs named — none of the others", async () => {
    const calls = stubServer(EVERY_BLOB_BUT_THE_PROFILE);
    const m = await freshModules();

    await expect(m.ensureAdminConfigHydrated(["custom-code"])).resolves.toBe(true);
    expect(calls).toEqual(["GET /api/admin-config/custom-code"]);
  });
});

describe("the admin shell asks only for what the member may read", () => {
  const readable = (isOwner: boolean, held: string[]) =>
    Object.keys(ADMIN_CONFIG_ACCESS).filter((key) =>
      mayUseAdminConfigBlob({ isOwner, has: (p) => held.includes(p) }, key, "read"),
    );

  it("the owner reads all four", () => {
    expect(readable(true, [])).toEqual(["admin-profile", "payment-gateways", "payment-notif-prefs", "custom-code"]);
  });

  it("kitchen staff read none", () => {
    expect(readable(false, ["orders.view_kitchen", "orders.update_status"])).toEqual([]);
  });

  it("a manager with payments reads the payment blobs, never the owner's profile", () => {
    expect(readable(false, ["payments.view", "payments.manage"])).toEqual(["payment-gateways", "payment-notif-prefs"]);
  });
});
