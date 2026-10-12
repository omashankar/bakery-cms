import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { StorefrontCacheSeed } from "@/apps/website/components/storefront-cache-seed";
import { isStorefrontSeeded } from "@/lib/storefront-seed-flag";
import { couponsHydration, zonesHydration } from "@/features/commerce/lib/commerce-api";
import { bannersLoaded, bannersWritable, faqsLoaded } from "@/features/content/lib/content-api";
import { catalogHydrationStatus } from "@/features/catalog/lib/catalog-api";
import { loadCoupons } from "@/features/commerce/lib/coupons-repository";
import { loadDeliveryZones } from "@/features/commerce/lib/delivery-zones-repository";
import { loadBanners } from "@/features/content/lib/banners-repository";
import { loadSettings } from "@/features/settings/lib/settings-repository";
import { settingsHydration } from "@/features/settings/lib/settings-api";
import {
  getCustomerSession,
  hasCustomerSessionSettled,
} from "@/apps/website/account/lib/customer-session";

/**
 * THE STOREFRONT BRINGS ITS CACHES WITH THE PAGE.
 *
 * The root providers fetched eight things after every storefront page had
 * loaded — settings, catalogue, coupons, zones, banners, testimonials, FAQ
 * and who is signed in — on a phone's shared connection, racing the page's
 * images, while checkout priced from whatever the browser last held. The
 * layout now reads them with the page and `StorefrontCacheSeed` writes them
 * the way those syncs wrote a VISITOR's answer.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const DATA = {
  settings: { general: { siteName: "Seeded Shop" } },
  catalog: { categories: [{ id: "c1", name: "Seeded Cakes", slug: "seeded" }] },
  coupons: [{ id: "cp1", code: "SEEDED10", isActive: true }],
  zones: [{ id: "z1", name: "Seeded Zone", city: "Kota", pincode: "324", isActive: true }],
  banners: [{ id: "b1", title: "Seeded banner", image: "/b.jpg" }],
  testimonials: [],
  faqs: [],
  customer: { email: "seeded@example.com", name: "Seeded Customer", phone: "" },
};

describe("a visitor's page", () => {
  it("fills every cache, opens the read gates, and says so", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    act(() => root.render(createElement(StorefrontCacheSeed, { data: DATA as never })));

    expect(loadSettings().general.siteName).toBe("Seeded Shop");
    expect(catalogHydrationStatus()).toBe("ready");
    expect(loadCoupons().map((coupon) => coupon.code)).toEqual(["SEEDED10"]);
    expect(loadDeliveryZones().map((zone) => zone.name)).toEqual(["Seeded Zone"]);
    expect(loadBanners().map((banner) => banner.id)).toEqual(["b1"]);
    expect(getCustomerSession()?.email).toBe("seeded@example.com");

    expect(couponsHydration.hasSettled()).toBe(true);
    expect(zonesHydration.hasSettled()).toBe(true);
    expect(bannersLoaded.hasSettled()).toBe(true);
    expect(faqsLoaded.hasSettled()).toBe(true);
    expect(hasCustomerSessionSettled()).toBe(true);
    expect(isStorefrontSeeded()).toBe(true);

    act(() => root.unmount());
    container.remove();
  });

  it("never vouches for a save from a visitor's partial lists", () => {
    // A public list is not the whole collection; composing a replace-all
    // from it deletes everything a visitor cannot see.
    expect(bannersWritable.hasSettled()).toBe(false);
    expect(settingsHydration.hasSettled()).toBe(false);
  });
});

describe("the syncs it replaces", () => {
  it.each([
    "components/shared/catalog-server-sync.tsx",
    "components/shared/commerce-server-sync.tsx",
    "components/shared/content-server-sync.tsx",
  ])("%s stands down when the page brought its data", (file) => {
    expect(read(file)).toContain("if (isStorefrontSeeded()) return;");
  });

  it("the settings sync stands down for a visitor only", () => {
    expect(read("components/shared/settings-server-sync.tsx")).toContain(
      "if (!privileged && isStorefrontSeeded()) return;",
    );
  });

  it("both storefront layouts seed, and only a visitor's page is seeded", () => {
    for (const layout of ["app/(storefront)/layout.tsx", "app/account/layout.tsx"]) {
      expect(read(layout)).toContain("{cacheSeed ? <StorefrontCacheSeed data={cacheSeed} /> : null}");
    }
    expect(read("apps/website/lib/storefront-cache-seed.server.ts")).toContain(
      'if (session && (session.role === "owner" || session.role === "admin")) return null;',
    );
  });
});
