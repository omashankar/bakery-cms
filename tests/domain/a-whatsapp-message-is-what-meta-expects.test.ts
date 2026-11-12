/**
 * A WHATSAPP MESSAGE IS WHAT META EXPECTS.
 *
 * The shop has no WhatsApp keys yet, so nothing has ever been sent for real.
 * When they are added, the first order must go out — so the request itself is
 * pinned here against Meta's Cloud API: the endpoint, the bearer token, and the
 * template body with its positional parameters.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const conn = vi.hoisted(() => ({
  value: { phoneNumberId: "123456789", businessAccountId: "987", accessToken: "EAAG-secret-token", enabled: true },
}));
vi.mock("@/features/communications/server/whatsapp-credentials.server", () => ({
  readWhatsAppConnection: async () => conn.value,
}));

import { sendWhatsAppTemplate } from "@/features/communications/server/whatsapp-client.server";

afterEach(() => {
  vi.unstubAllGlobals();
  conn.value = { phoneNumberId: "123456789", businessAccountId: "987", accessToken: "EAAG-secret-token", enabled: true };
});

describe("sending an approved template", () => {
  it("posts Meta's template message shape to the number's /messages", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ messages: [{ id: "wamid.ABC" }] }), { status: 200 });
    });

    const result = await sendWhatsAppTemplate({
      to: "98765 43210",
      metaName: "order_ready",
      metaLanguage: "en",
      parameters: ["Riya", "BK-20261105-0042"],
    });

    expect(result).toEqual({ sent: true, messageId: "wamid.ABC" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/^https:\/\/graph\.facebook\.com\/v\d+\.\d+\/123456789\/messages$/);
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer EAAG-secret-token");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "919876543210",
      type: "template",
      template: {
        name: "order_ready",
        language: { code: "en" },
        components: [
          { type: "body", parameters: [{ type: "text", text: "Riya" }, { type: "text", text: "BK-20261105-0042" }] },
        ],
      },
    });
  });

  it("does not send while the connection is switched off", async () => {
    conn.value = { ...conn.value, enabled: false };
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await sendWhatsAppTemplate({ to: "9876543210", metaName: "order_ready", metaLanguage: "en", parameters: [] });
    expect(result.sent).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never repeats the token in an error, whatever Meta echoes back", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ error: { message: "Invalid OAuth token EAAG-secret-token" } }), { status: 401 }),
    );
    const result = await sendWhatsAppTemplate({ to: "9876543210", metaName: "order_ready", metaLanguage: "en", parameters: [] });
    expect(result.sent).toBe(false);
    expect(result.error ?? "").not.toContain("EAAG-secret-token");
  });
});
