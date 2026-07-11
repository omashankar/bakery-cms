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
  occasions: [
    { label: "Birthday", href: routes.store.collection("birthday") },
    { label: "Anniversary", href: routes.store.collection("anniversary") },
    { label: "Wedding", href: routes.store.weddingCakes },
    { label: "Kids Party", href: routes.store.collection("custom") },
  ] satisfies MegaMenuLink[],
  featured: {
    title: "Seasonal Collection",
    description: "Limited-edition flavours for this season.",
    href: routes.store.collection("seasonal"),
    image:
      "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&h=500&fit=crop",
  },
};
