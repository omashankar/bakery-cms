/**
 * Every client dual-write in this repo writes localStorage first (so the UI is
 * instant) and then the server (which is the source of truth). The local write
 * always succeeds, so `persisted` is the only thing that distinguishes a saved
 * change from one that merely looks saved until the next hydration.
 *
 * These pin that contract across the modules where it was missing entirely: the
 * request was fire-and-forget, or the helper never checked `res.ok`, so a 401
 * from an expired token and a 500 both read as success.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addInquiry,
  deleteInquiries,
  loadInquiries,
  updateInquiry,
} from "@/features/inquiries/lib/inquiries-repository";
import {
  adjustStock,
  defaultInventorySettings,
  saveInventorySettings,
  setUnlimitedStock,
} from "@/apps/admin/commerce/lib/inventory-repository";
import { persistProducts } from "@/features/products/lib/products-repository";
import {
  getGeneralSettings,
  saveCommerceSettings,
  saveGeneralSettings,
  saveMaintenanceSettings,
  saveSecuritySettings,
} from "@/features/settings/lib/settings-repository";
import {
  defaultCommerceSettings,
  defaultGeneralSettings,
  defaultMaintenanceSettings,
  defaultSecuritySettings,
} from "@/features/settings/lib/settings-utils";
import {
  addNewsletterSubscriber,
  deleteNewsletterSubscribers,
  updateNewsletterSubscriber,
} from "@/features/inquiries/lib/newsletter-repository";
import {
  approveReviews,
  createReview,
  deleteReviews,
  rejectReviews,
  setReviewStatus,
} from "@/features/reviews/lib/reviews-repository";
import {
  getActiveSessions,
  logoutAllDevices,
  persistServerSecurityCenter,
  revokeSession,
} from "@/features/settings/lib/security-center-repository";
import type { SecurityCenterState } from "@/types/security";
import { settingsHydration } from "@/features/settings/lib/settings-api";
import { inventoryHydration } from "@/apps/admin/commerce/lib/inventory-api";

/** Stub the dual-write endpoints with a fixed HTTP outcome. */
function mockServer(ok: boolean, status = ok ? 200 : 500) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve({ success: ok, data: ok ? {} : null }),
  } as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const inquiry = {
  type: "contact" as const,
  name: "Asha Menon",
  email: "asha@example.com",
  message: "Do you make eggless cakes?",
};

const review = {
  cakeId: "cake-1",
  productSlug: "black-forest",
  cakeName: "Black Forest",
  authorName: "Asha",
  rating: 5,
  body: "Lovely",
  status: "pending" as const,
  isFeatured: false,
};

beforeEach(() => {
  localStorage.clear();
  // Stands in for `SettingsServerSync`, which opens the settings gate once the
  // server's copy has been read. Without it a section PUT refuses to send — see
  // the "settings hydration gate" block below.
  settingsHydration.markSettled();
  // Inventory settings are a whole-document PUT too, and had no gate at all
  // until the seed-clobber sweep — a browser whose read failed replaced the
  // shop's low-stock thresholds with the defaults.
  inventoryHydration.markSettled();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("inquiry writes", () => {
  it("reports persisted only when the server accepted them", async () => {
    mockServer(true);
    const created = await addInquiry(inquiry);
    expect(created.persisted).toBe(true);

    mockServer(false);
    await expect(addInquiry(inquiry)).resolves.toMatchObject({ persisted: false });
    await expect(
      updateInquiry(created.inquiry!.id, { status: "replied" })
    ).resolves.toMatchObject({ persisted: false });
    await expect(deleteInquiries([created.inquiry!.id])).resolves.toMatchObject({
      persisted: false,
    });
  });

  it("reports NOT persisted when the request fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(addInquiry(inquiry)).resolves.toMatchObject({ persisted: false });
  });

  it("still applies locally, so the change is not lost while it is reported", async () => {
    mockServer(false);

    const { inquiry: created } = await addInquiry(inquiry);

    // Read it back out of STORAGE, not off the returned object. Asserting on the
    // return value only proves the input was echoed — delete the
    // `persistInquiries` call entirely and that assertion still passes. The
    // local half of the dual-write is what the retry and the instant UI both
    // depend on, so it has to be checked where it actually lands.
    const stored = loadInquiries();
    expect(stored.map((entry) => entry.id)).toContain(created?.id);
    expect(stored.find((entry) => entry.id === created?.id)?.name).toBe("Asha Menon");
  });
});

describe("newsletter writes", () => {
  it("reports persisted only when the server accepted them", async () => {
    mockServer(true);
    const created = await addNewsletterSubscriber("asha@example.com");
    expect(created.persisted).toBe(true);

    mockServer(false);
    await expect(
      updateNewsletterSubscriber(created.subscriber!.id, { isActive: false })
    ).resolves.toMatchObject({ persisted: false });
    await expect(deleteNewsletterSubscribers([created.subscriber!.id])).resolves.toMatchObject({
      persisted: false,
    });
  });

  it("reports a rejected re-subscribe of a known email", async () => {
    mockServer(true);
    await addNewsletterSubscriber("asha@example.com");

    // The dedupe path returns the existing row — it must still carry the real
    // outcome of the PUBLIC subscribe request rather than assuming success.
    mockServer(false);
    await expect(addNewsletterSubscriber("asha@example.com")).resolves.toMatchObject({
      persisted: false,
    });
  });
});

describe("review moderation writes", () => {
  it("reports persisted only when the server accepted them", async () => {
    mockServer(true);
    const created = await createReview(review);
    expect(created.persisted).toBe(true);

    mockServer(false);
    await expect(setReviewStatus(created.review!.id, "approved")).resolves.toMatchObject({
      persisted: false,
    });
    await expect(deleteReviews([created.review!.id])).resolves.toMatchObject({ persisted: false });
  });

  it("counts a bulk moderation per id instead of assuming the batch went through", async () => {
    mockServer(true);
    const a = await createReview(review);
    const b = await createReview({ ...review, authorName: "Ravi" });
    const ids = [a.review!.id, b.review!.id];

    const fetchMock = mockServer(false);
    const rejected = await approveReviews(ids);

    // `ids.forEach(async …)` discarded every answer, so a batch the server
    // refused whole was indistinguishable from one it accepted whole.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(rejected).toEqual({ updated: 0, failed: 2 });

    mockServer(true);
    await expect(rejectReviews(ids)).resolves.toEqual({ updated: 2, failed: 0 });
  });
});

describe("inventory writes", () => {
  /** One tracked product, so adjustStock has something to adjust. */
  function seedProduct() {
    persistProducts([
      {
        id: "cake-1",
        slug: "black-forest",
        name: "Black Forest",
        stockQuantity: 20,
        unlimitedStock: false,
        lowStockThreshold: 5,
        status: "published",
      },
    ] as unknown as Parameters<typeof persistProducts>[0]);
  }

  it("reports persisted only when the server accepted the adjustment", async () => {
    seedProduct();
    mockServer(true);
    await expect(adjustStock({ cakeId: "cake-1", type: "remove", quantity: 5 })).resolves.toMatchObject(
      { persisted: true }
    );

    // Stock is the number the storefront sells against and it lives in Mongo. A
    // local-only change means the shop keeps selling a cake the admin believes
    // they have taken off the shelf — so this must never read as success.
    mockServer(false);
    await expect(adjustStock({ cakeId: "cake-1", type: "remove", quantity: 5 })).resolves.toMatchObject(
      { persisted: false }
    );
    await expect(setUnlimitedStock("cake-1", true)).resolves.toMatchObject({ persisted: false });
    await expect(
      saveInventorySettings({ ...defaultInventorySettings, defaultLowStockThreshold: 3 })
    ).resolves.toMatchObject({ persisted: false });
  });

  it("reports NOT persisted when the request fails outright", async () => {
    seedProduct();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(adjustStock({ cakeId: "cake-1", type: "add", quantity: 1 })).resolves.toMatchObject(
      { persisted: false }
    );
  });
});

describe("settings writes", () => {
  it("reports persisted only when the server accepted the section", async () => {
    mockServer(true);
    await expect(
      saveSecuritySettings({ ...defaultSecuritySettings, sessionTimeoutMinutes: 45 })
    ).resolves.toMatchObject({ persisted: true });

    // `SettingsServerSync` merges the server's copy over the local one on the
    // next admin page load, so a rejected section is not saved — it is reverted.
    // This whole path used to be `void pushSection(...)`, discarding the boolean
    // it already had, so every settings page toasted success on a 401.
    mockServer(false);
    await expect(
      saveSecuritySettings({ ...defaultSecuritySettings, sessionTimeoutMinutes: 45 })
    ).resolves.toMatchObject({ persisted: false });
    await expect(
      saveCommerceSettings({ ...defaultCommerceSettings, deliveryFee: 99 })
    ).resolves.toMatchObject({ persisted: false });
    await expect(
      saveMaintenanceSettings({ ...defaultMaintenanceSettings, isEnabled: true })
    ).resolves.toMatchObject({ persisted: false });
  });

  it("reports NOT persisted when the request fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(
      saveGeneralSettings({ ...defaultGeneralSettings, siteName: "Offline Bakes" })
    ).resolves.toMatchObject({ persisted: false });
  });

  it("still applies the section locally, so the edit is not lost while it is reported", async () => {
    mockServer(false);

    await saveGeneralSettings({ ...defaultGeneralSettings, siteName: "Local Only Bakes" });

    expect(getGeneralSettings().siteName).toBe("Local Only Bakes");
  });
});

describe("the settings hydration gate", () => {
  /**
   * `PUT /api/settings/general` replaces the whole section, not the one field the
   * admin edited. Before the server's copy has been read, the local section is
   * whatever `loadSettings()` seeded into an empty localStorage — the demo
   * defaults. Sending that overwrites the shop's real name, logo, timezone and
   * currency in Mongo, from one Save, silently.
   *
   * Every other replace-all store in the repo already waited for hydration;
   * settings was the one that did not.
   */
  it("refuses to send a section before the server's copy has been read", async () => {
    // A fresh module instance, so the process-wide gate is closed again — this is
    // a browser whose settings read failed, or has not finished.
    vi.resetModules();
    const fresh = await import("@/features/settings/lib/settings-api");
    const fetchMock = mockServer(true);

    vi.useFakeTimers();
    try {
      const pushed = fresh.pushSection("general", { ...defaultGeneralSettings });
      // Give up waiting rather than send an unhydrated section.
      await vi.advanceTimersByTimeAsync(10_000);
      await expect(pushed).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends once hydration has landed", async () => {
    vi.resetModules();
    const fresh = await import("@/features/settings/lib/settings-api");
    const fetchMock = mockServer(true);

    fresh.settingsHydration.markSettled();

    await expect(fresh.pushSection("general", { ...defaultGeneralSettings })).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/settings/general",
      expect.objectContaining({ method: "PUT" })
    );
  });
});

describe("session revocation", () => {
  /** Seed one revocable session alongside the current one. */
  function seedSessions() {
    persistServerSecurityCenter({
      loginHistory: [],
      failedAttempts: [],
      devices: [],
      activeSessions: [
        { id: "sess-current", isCurrent: true, device: "This browser" },
        { id: "sess-other", isCurrent: false, device: "Another laptop" },
      ],
    } as unknown as SecurityCenterState);
  }

  it("revokes only once the server confirms it", async () => {
    seedSessions();
    mockServer(true);

    await expect(revokeSession("sess-other")).resolves.toBe(true);
  });

  it("reports failure AND keeps the session listed when the server refuses", async () => {
    seedSessions();
    mockServer(false, 401); // e.g. the admin's own token just expired

    expect(await revokeSession("sess-other")).toBe(false);

    // The row must survive. Dropping it locally would tell the admin the session
    // is gone while it is still live, and remove the row they would retry from.
    expect(getActiveSessions().map((session) => session.id)).toContain("sess-other");
  });

  it("refuses to revoke the current session without asking the server", async () => {
    seedSessions();
    const fetchMock = mockServer(true);

    expect(await revokeSession("sess-current")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("counts sign-out-everywhere from the SERVER, not the cached session list", async () => {
    seedSessions();
    mockServer(false);
    // Nothing was revoked, so nothing is claimed — the old code reported the
    // local list's count here regardless.
    await expect(logoutAllDevices()).resolves.toEqual({ removed: 0, persisted: false });

    // The cache holds one other session; the server says it revoked three (the
    // admin signed in elsewhere after this page loaded). The server wins.
    seedSessions();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { revoked: 3 } }),
      } as unknown as Response)
    );
    await expect(logoutAllDevices()).resolves.toEqual({ removed: 3, persisted: true });
  });
});
