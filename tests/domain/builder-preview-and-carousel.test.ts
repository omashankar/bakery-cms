import { beforeEach, describe, expect, it, vi } from "vitest";


// Only WHO is signed in is faked; the permission check itself is the real one.
const getActor = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/auth/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/auth/access")>()),
  getActor,
}));

const getSettings = vi.hoisted(() => vi.fn());
vi.mock("@/features/settings/server/settings.service", () => ({ getSettings }));

import { canPreviewDraft } from "@/apps/website/lib/preview-access.server";
import { getStorefrontLocation } from "@/apps/website/lib/storefront-location.server";
import { contactInfo, businessHours } from "@/constants/landing-data";

function member(permissions: string[]) {
  return { sub: "u1", email: "m@example.com", name: "M", role: "x", roleName: "X", isOwner: false, permissions: new Set(permissions) };
}

/**
 * `/store?cmsPreview=1` and `/store/wedding-cakes?cmsPreview=wedding` rendered
 * the unpublished draft to anybody who put the parameter on the URL — no session
 * check anywhere in the path. Preview links open in an ordinary tab and get
 * pasted into chats, and `generateMetadata` returns the same metadata for the
 * preview URL, so a leaked link is indexable with draft content in it.
 *
 * Since roles: a team member sees a draft only if they could open it in the
 * admin — the homepage draft needs the homepage builder, a page draft needs
 * pages. Kitchen staff signed in to the admin do not get either.
 */
describe("who may see an unpublished draft", () => {
  beforeEach(() => {
    getActor.mockReset();
  });

  it("lets a member through to the draft they may edit", async () => {
    getActor.mockResolvedValue(member(["homepage.manage"]));
    expect(await canPreviewDraft("homepage.manage")).toBe(true);
  });

  it("turns away a member who may not edit THAT draft", async () => {
    getActor.mockResolvedValue(member(["orders.view_kitchen", "orders.update_status"]));
    expect(await canPreviewDraft("homepage.manage")).toBe(false);
    expect(await canPreviewDraft("pages.view")).toBe(false);
  });

  it("turns a signed-out visitor away", async () => {
    getActor.mockResolvedValue(null);
    expect(await canPreviewDraft("pages.view")).toBe(false);
  });

  it("fails closed when the session check itself breaks", async () => {
    // A session store that is down must not open the draft to the world.
    getActor.mockRejectedValue(new Error("session store unreachable"));
    expect(await canPreviewDraft("pages.view")).toBe(false);
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
