import type { Metadata } from "next";
import { cookies } from "next/headers";

import { CartPage } from "@/apps/website/pages/cart-page";
import { getStorefrontProductCards } from "@/features/products/data/products-service";
import { getPublicSettings } from "@/features/settings/server/settings.service";
import { getPublicZones } from "@/features/commerce/server/commerce.service";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import { CART_COOKIE, decodeCartCookie } from "@/features/cart/lib/cart-cookie";
import type { CommerceSettings } from "@/types/settings";

export const metadata: Metadata = {
  title: "Shopping Cart",
  description: "Review items in your cart.",
};

export default async function Page() {
  // The "recently viewed" rail resolves saved slugs against this. Read on the
  // server because the browser has no catalogue of its own — the admin's
  // product cache is not populated on a customer's device.
  const [catalog, settings, zones, jar] = await Promise.all([
    getStorefrontProductCards(),
    getPublicSettings(),
    getPublicZones(),
    cookies(),
  ]);

  // The lines this browser's cart held when it last changed, so the page is
  // drawn with them instead of a skeleton (see cart-cookie.ts) — and the
  // shop's own delivery rules beside them, merged over the defaults exactly as
  // the browser merges them, so the first numbers are the right ones.
  const initialItems = decodeCartCookie(jar.get(CART_COOKIE)?.value);
  const stored = (settings.commerce ?? {}) as Partial<CommerceSettings>;
  const initialCommerce: CommerceSettings = {
    ...defaultCommerceSettings,
    ...stored,
    paymentMethods: { ...defaultCommerceSettings.paymentMethods, ...(stored.paymentMethods ?? {}) },
  };

  return (
    <CartPage
      catalog={catalog}
      initialItems={initialItems}
      initialCommerce={initialCommerce}
      // The delivery box is drawn with the page rather than after it.
      initialZones={JSON.parse(JSON.stringify(zones))}
    />
  );
}
