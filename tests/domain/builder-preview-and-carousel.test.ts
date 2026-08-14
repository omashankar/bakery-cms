import { beforeEach, describe, expect, it, vi } from "vitest";

import { activeSlideIndex, type HeroSlide } from "@/features/cms-sections/hero-carousel";

const requireRole = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/auth/dal", () => ({ requireRole }));

const getSettings = vi.hoisted(() => vi.fn());
vi.mock("@/features/settings/server/settings.service", () => ({ getSettings }));

import { canPreviewDraft } from "@/apps/website/lib/preview-access.server";
import { getStorefrontLocation } from "@/apps/website/lib/storefront-location.server";
import { contactInfo, businessHours } from "@/constants/landing-data";

/**
 * `/store?cmsPreview=1` and `/store/wedding-cakes?cmsPreview=wedding` rendered
 * the unpublished draft to anybody who put the parameter on the URL — no session
 * check anywhere in the path. Preview links open in an ordinary tab and get
 * pasted into chats, and `generateMetadata` returns the same metadata for the
 * preview URL, so a leaked link is indexable with draft content in it.
 */
describe("who may see an unpublished draft", () => {
  beforeEach(() => {
    requireRole.mockReset();
  });

  it("lets an owner or admin through", async () => {
    requireRole.mockResolvedValue({ sub: "u1", role: "admin" });

    expect(await canPreviewDraft()).toBe(true);
    expect(requireRole).toHaveBeenCalledWith("owner", "admin");
  });

  it("turns a signed-out visitor away", async () => {
    requireRole.mockRejectedValue(new Error("Unauthorized"));

    expect(await canPreviewDraft()).toBe(false);
  });

  it("turns away a signed-in customer who is not staff", async () => {
    requireRole.mockRejectedValue(new Error("Forbidden"));

    expect(await canPreviewDraft()).toBe(false);
  });

  it("fails closed when the session check itself breaks", async () => {
    // A session store that is down must not open the draft to the world.
    requireRole.mockImplementation(() => {
      throw new Error("session store unreachable");
    });

    expect(await canPreviewDraft()).toBe(false);
  });
});

/**
 * The store locator says where the shop is. It used to say where three invented
 * Mumbai outlets were, 1.2 / 3.5 / 6.8 km from wherever the customer happened to
 * be, above a pincode box that searched nothing.
 *
 * The trap in replacing that with Settings → Contact is that the settings
 * singleton is CREATED holding the shipped demo values — "123 Baker Street,
 * Mumbai" and three demo opening-hours rows — so an "is it filled in?" check can
 * never fail, and three invented outlets become one invented outlet.
 */
describe("the shop's real address", () => {
  beforeEach(() => {
    getSettings.mockReset();
  });

  const REAL = {
    address: "7 Nehru Place, New Delhi 110019",
    phone: "+91 98111 22233",
    businessHours: [{ day: "Every day", hours: "8am – 8pm" }],
  };

  it("shows a shop that has set its own address", async () => {
    getSettings.mockResolvedValue({ contact: REAL });

    const location = await getStorefrontLocation();

    expect(location?.address).toBe(REAL.address);
    expect(location?.phone).toBe(REAL.phone);
    expect(location?.hours).toEqual([{ day: "Every day", hours: "8am – 8pm" }]);
    // Built from the address, never from the admin-typed mapEmbedUrl.
    expect(location?.mapUrl).toContain(encodeURIComponent(REAL.address));
  });

  it("shows nothing for a shop still carrying the shipped demo address", async () => {
    getSettings.mockResolvedValue({
      contact: {
        address: contactInfo.address,
        phone: contactInfo.phone,
        businessHours: businessHours.map((entry) => ({ ...entry })),
      },
    });

    expect(await getStorefrontLocation()).toBeNull();
  });

  it("still shows nothing when only the phone is real", async () => {
    // This is the live shop: a seeded Mumbai address with a genuine phone number
    // beside it. Verified against the running app — it produced a panel headed
    // "Find a Store Near You" containing one tel: link and nothing else.
    getSettings.mockResolvedValue({
      contact: {
        address: contactInfo.address,
        phone: "07627014106",
        businessHours: businessHours.map((entry) => ({ ...entry })),
      },
    });

    expect(await getStorefrontLocation()).toBeNull();
  });

  it("drops the shipped opening hours but keeps a shop's own", async () => {
    getSettings.mockResolvedValue({
      contact: { ...REAL, businessHours: businessHours.map((entry) => ({ ...entry })) },
    });

    expect((await getStorefrontLocation())?.hours).toEqual([]);
  });

  it("never puts the admin-typed map URL in the page", async () => {
    getSettings.mockResolvedValue({
      contact: { ...REAL, mapEmbedUrl: "javascript:alert(1)" },
    });

    const location = await getStorefrontLocation();

    expect(location?.mapUrl.startsWith("https://www.google.com/maps/")).toBe(true);
    expect(location?.mapUrl).not.toContain("javascript");
  });

  it("shows nothing rather than failing the homepage when settings cannot be read", async () => {
    getSettings.mockRejectedValue(new Error("mongo down"));

    expect(await getStorefrontLocation()).toBeNull();
  });
});

/**
 * The hero carousel's index is state and outlives a shrinking slide list.
 * Autoplay walks it to the last slide within seconds, so removing the last slide
 * in the builder left `slides[index]` undefined and `slide.badge` threw — inside
 * the builder's live preview, which has no error boundary, taking every unsaved
 * edit with it.
 */
describe("the hero carousel's active slide", () => {
  it("stays in range when the admin deletes the slide being shown", () => {
    const before: HeroSlide[] = [1, 2, 3].map((n) => ({
      headline: `slide ${n}`,
      primaryLabel: "Shop",
      primaryHref: "/store",
      imageUrl: "",
    }));
    const afterDelete = before.slice(0, 2);

    // Autoplay (or a click on the third dot) left the index at 2.
    const index = 2;
    expect(before[activeSlideIndex(index, before.length)]).toBeDefined();

    const shown = afterDelete[activeSlideIndex(index, afterDelete.length)];
    expect(shown).toBeDefined();
    expect(shown.headline).toBe("slide 2");
  });

  it("holds the index steady while it is still in range", () => {
    expect(activeSlideIndex(0, 3)).toBe(0);
    expect(activeSlideIndex(1, 3)).toBe(1);
    expect(activeSlideIndex(2, 3)).toBe(2);
  });

  it("never returns an index the list cannot answer", () => {
    for (const count of [1, 2, 3, 8]) {
      for (const index of [0, 1, 5, 99]) {
        const resolved = activeSlideIndex(index, count);
        expect(resolved).toBeGreaterThanOrEqual(0);
        expect(resolved).toBeLessThan(count);
      }
    }
  });
});
