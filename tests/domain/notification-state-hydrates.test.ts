import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The server document is only worth having if entering the admin actually reads
 * it. This pins the wiring: a per-admin read/dismissed state that nothing
 * fetches on load is indistinguishable from the browser-only version it
 * replaced — the phone would still show every alert unread, and the fault would
 * be invisible in every other test, all of which drive the repository directly.
 */
const gate = () => ({ hasSettled: vi.fn(() => false), markSettled: vi.fn() });

const api = vi.hoisted(() => ({
  emailTemplatesHydration: { hasSettled: vi.fn(() => false), markSettled: vi.fn() },
  whatsappTemplatesHydration: { hasSettled: vi.fn(() => false), markSettled: vi.fn() },
  notificationSettingsHydration: { hasSettled: vi.fn(() => false), markSettled: vi.fn() },
  notificationStateHydration: { hasSettled: vi.fn(() => false), markSettled: vi.fn() },
  fetchEmailTemplates: vi.fn(async () => null),
  fetchWhatsAppTemplates: vi.fn(async () => null),
  fetchNotificationSettings: vi.fn(async () => null),
  fetchNotificationState: vi.fn(async () => null as unknown),
}));

const persisted = vi.hoisted(() => ({
  settings: vi.fn(),
  state: vi.fn(),
}));

vi.mock("@/apps/admin/communications/lib/communications-api", () => api);
vi.mock("@/apps/admin/communications/lib/email-templates-repository", () => ({
  persistServerEmailTemplates: vi.fn(),
}));
vi.mock("@/apps/admin/communications/lib/whatsapp-templates-repository", () => ({
  persistServerWhatsAppTemplates: vi.fn(),
}));
vi.mock("@/apps/admin/commerce/lib/notifications-repository", () => ({
  persistServerNotificationSettings: persisted.settings,
  persistServerNotificationState: persisted.state,
}));

import { ensureCommunicationsHydrated } from "@/apps/admin/communications/lib/use-communications-server-sync";

describe("entering the admin loads this admin's read state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.notificationStateHydration = gate();
  });

  it("fetches the server's copy and applies it", async () => {
    const state = { read: ["order:1"], dismissed: ["stock:2:low_stock"] };
    api.fetchNotificationState.mockResolvedValueOnce(state);

    await ensureCommunicationsHydrated();

    expect(api.fetchNotificationState).toHaveBeenCalled();
    expect(persisted.state).toHaveBeenCalledWith(state);
    expect(api.notificationStateHydration.markSettled).toHaveBeenCalled();
  });

  it("does not settle, or touch the local cache, on a failed read", async () => {
    api.fetchNotificationState.mockResolvedValueOnce(null);

    await ensureCommunicationsHydrated();

    // A null is a failed read, not "this admin has read nothing" — settling on
    // it would leave the local set unbacked for the rest of the session.
    expect(persisted.state).not.toHaveBeenCalled();
    expect(api.notificationStateHydration.markSettled).not.toHaveBeenCalled();
  });

  it("does not re-fetch once it has been read", async () => {
    api.notificationStateHydration.hasSettled.mockReturnValue(true);

    await ensureCommunicationsHydrated();

    expect(api.fetchNotificationState).not.toHaveBeenCalled();
  });

  it("reads the state even when every other collection fails", async () => {
    // One gate per collection: a WhatsApp fetch that 500s must not take the
    // admin's read state down with it.
    api.fetchEmailTemplates.mockResolvedValueOnce(null);
    api.fetchWhatsAppTemplates.mockResolvedValueOnce(null);
    api.fetchNotificationSettings.mockResolvedValueOnce(null);
    api.fetchNotificationState.mockResolvedValueOnce({ read: ["a"], dismissed: [] });

    await ensureCommunicationsHydrated();

    expect(persisted.state).toHaveBeenCalledWith({ read: ["a"], dismissed: [] });
  });
});
