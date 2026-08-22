import { routes } from "./routes";

export interface MegaMenuLink {
  label: string;
  href: string;
  description?: string;
}

export const shopMegaMenu = {
  categories: [
    { label: "All Cakes", href: routes.store.collections },
    { label: "Birthday Cakes", href: routes.store.collection("birthday") },
    { label: "Wedding Cakes", href: routes.store.weddingCakes },
    { label: "Photo Cakes", href: routes.store.collection("photo-cakes") },
    { label: "Eggless Cakes", href: routes.store.collection("eggless") },
    { label: "Seasonal", href: routes.store.collection("seasonal") },
    { label: "Best Sellers", href: `${routes.store.collections}?sort=popular` },
  ] satisfies MegaMenuLink[],
  /**
   * These are hardcoded, and the catalogue they point into is not — so every
   * entry here is a promise this file cannot keep on its own.
   *
   * "Kids Party" used to sit at the end, pointing at a "custom" category. A shop
   * that has no such category — and the seeded catalogue is one — served a menu
   * item that opened "0 cakes". Add an entry here only when the slug is one the
   * shop is guaranteed to have; anything shop-specific belongs in the catalogue,
   * where deleting the category also removes the way in.
   */
  occasions: [
    { label: "Birthday", href: routes.store.collection("birthday") },
    { label: "Anniversary", href: routes.store.collection("anniversary") },
    { label: "Wedding", href: routes.store.weddingCakes },
  ] satisfies MegaMenuLink[],
  featured: {
    title: "Seasonal Collection",
    description: "Limited-edition flavours for this season.",
    href: routes.store.collection("seasonal"),
    image:
      "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&h=500&fit=crop",
  },
};
