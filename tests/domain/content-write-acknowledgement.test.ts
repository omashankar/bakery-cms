/**
 * The content and configuration stores — the last group still reporting success
 * for writes that never left the browser.
 *
 * All seven of their API modules shared one helper:
 *
 *   function putJson(path, body): void {
 *     void (async () => { try { await fetch(...) } catch {} })();
 *   }
 *
 * It launched the request into a floating async IIFE, never looked at
 * `res.ok`, and returned void. So a 401 from an expired admin token and a 500
 * were indistinguishable from success, and every page above them toasted
 * "saved" for a change the next hydration silently reverted.
 *
 * These pin the contract per store. They are deliberately shallow — one accepted
 * write, one rejected, one thrown request — because the failure they guard
 * against is exactly that shallow, and it shipped in nineteen screens.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createBanner, deleteBanners } from "@/features/content/lib/banners-repository";
import { createFaq, deleteFaqs } from "@/features/content/lib/faq-repository";
import {
  createTestimonial,
  deleteTestimonials,
} from "@/features/content/lib/testimonials-repository";
import { createCoupon, deleteCoupons } from "@/features/commerce/lib/coupons-repository";
import {
  createDeliveryZone,
  deleteDeliveryZones,
} from "@/features/commerce/lib/delivery-zones-repository";
import { saveHeaderSettings, loadHeaderSettings } from "@/features/site-layout/lib/header-repository";
import { saveFooterSettings, loadFooterSettings } from "@/features/site-layout/lib/footer-repository";
import { saveGlobalSeo, getGlobalSeo } from "@/features/seo/lib/seo-repository";
import { createCategory, deleteCategories } from "@/features/catalog/lib/catalog-repository";
import { saveInvoiceSettings, loadInvoiceSettings } from "@/features/commerce/lib/invoice-settings-repository";
import {
  createMediaFolder,
  saveMediaFolders,
} from "@/apps/admin/media/lib/media-folders";
import { addMediaFile, deleteMediaFiles } from "@/apps/admin/media/lib/media-repository";
import {
  createEmailTemplate,

} from "@/apps/admin/communications/lib/email-templates-repository";
import { saveCustomCode } from "@/apps/admin/settings/lib/custom-code-repository";
import { saveAdminProfile } from "@/apps/admin/profile/lib/admin-profile";

/** Stub every dual-write endpoint with a fixed HTTP outcome. */
function mockServer(ok: boolean, status = ok ? 200 : 500) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve({ success: ok, data: ok ? {} : null }),
  } as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Each entry is one store: a write, and the phrase for the failure message.
 * Kept as data so a new store cannot be added without a line here.
 */
const WRITES: Array<[name: string, write: () => Promise<{ persisted: boolean }>]> = [
  ["banner create", () => createBanner({ title: "Diwali", image: "/x.jpg" } as never)],
  ["banner delete", () => deleteBanners(["nope"])],
  ["testimonial create", () => createTestimonial({ name: "Asha", quote: "Lovely" } as never)],
  ["testimonial delete", () => deleteTestimonials(["nope"])],
  ["faq create", () => createFaq({ question: "Eggless?", answer: "Yes" } as never)],
  ["faq delete", () => deleteFaqs(["nope"])],
  ["coupon create", () => createCoupon({ code: "SAVE10", label: "10% off" } as never)],
  ["coupon delete", () => deleteCoupons(["nope"])],
  ["zone create", () => createDeliveryZone({ name: "Bandra", city: "Mumbai" } as never)],
  // Deleting a real zone: an empty selection is an early return by design (nothing
  // sent, so nothing could fail), which would not exercise the write at all.
  [
    "zone delete",
    async () => {
      const { value: zone } = await createDeliveryZone({ name: "Andheri", city: "Mumbai" } as never);
      return deleteDeliveryZones([zone.id]);
    },
  ],
  ["header save", () => saveHeaderSettings(loadHeaderSettings())],
  ["footer save", () => saveFooterSettings(loadFooterSettings())],
  ["seo save", () => saveGlobalSeo(getGlobalSeo())],
  ["catalog create", () => createCategory({ name: "Cheesecake", slug: "cheesecake" } as never)],
  ["catalog delete", () => deleteCategories(["nope"])],
  ["invoice settings", () => saveInvoiceSettings(loadInvoiceSettings() as never)],
  ["media folder create", () => createMediaFolder("Diwali 2026")],
  ["media folders save", () => saveMediaFolders([])],
  ["media add", () => addMediaFile({ name: "a.jpg", url: "/a.jpg" } as never)],
  ["media delete", () => deleteMediaFiles(["nope"])],
  [
    "email template create",
    () =>
      createEmailTemplate({
        slug: "welcome",
        name: "Welcome",
        description: "Welcome mail",
        category: "transactional",
        subject: "Hi {{customer_name}}",
        previewText: "",
        body: "Hello {{customer_name}}",
        status: "draft",
        variables: ["customer_name"],
      } as never),
  ],
];

describe("content and configuration writes", () => {
  it("report persisted when the server accepts them", async () => {
    for (const [name, write] of WRITES) {
      mockServer(true);
      const result = await write();
      expect(result.persisted, `${name} should be persisted`).toBe(true);
    }
  });

  it("report NOT persisted when the server rejects them", async () => {
    for (const [name, write] of WRITES) {
      mockServer(false, 401); // e.g. the admin's token just expired
      const result = await write();
      expect(result.persisted, `${name} must not claim success`).toBe(false);
    }
  });

  it("report NOT persisted when the request fails outright", async () => {
    for (const [name, write] of WRITES) {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
      const result = await write();
      expect(result.persisted, `${name} must not claim success offline`).toBe(false);
    }
  });
});

describe("writes that return a bare boolean", () => {
  it("custom code reports what the server did", async () => {
    // This is script and style injected into every storefront page, rendered
    // from the server copy — a local-only save changes nothing any visitor sees.
    mockServer(true);
    await expect(saveCustomCode({ css: "body{}", js: "" })).resolves.toBe(true);

    mockServer(false);
    await expect(saveCustomCode({ css: "body{}", js: "" })).resolves.toBe(false);
  });

  it("the admin profile reports what the server did", async () => {
    mockServer(true);
    await expect(
      saveAdminProfile({ fullName: "Asha", mobile: "", username: "asha", photoUrl: "" })
    ).resolves.toBe(true);

    mockServer(false);
    await expect(
      saveAdminProfile({ fullName: "Asha", mobile: "", username: "asha", photoUrl: "" })
    ).resolves.toBe(false);
  });
});

describe("the local half still lands", () => {
  it("keeps a rejected banner in local storage, so the admin's work is not lost", async () => {
    mockServer(false);

    const { value: banner } = await createBanner({ title: "Diwali", image: "/x.jpg" } as never);

    // Read it back out of the STORE, not off the returned object — asserting on
    // the return value only proves the input was echoed.
    const { loadBanners } = await import("@/features/content/lib/banners-repository");
    expect(loadBanners().map((item) => item.id)).toContain(banner.id);
  });
});
