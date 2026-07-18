import { galleryImages } from "@/constants/landing-data";
import { loadBanners } from "@/features/content/lib/banners-repository";
import { loadProducts } from "@/features/products/lib/products-repository";
import { getAllProducts } from "@/features/products/lib/product-catalog";

export interface MediaUsageRef {
  label: string;
  context: string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scanStorageKeys(url: string, keys: string[], labelForKey: (key: string) => string): MediaUsageRef[] {
  if (typeof window === "undefined") return [];

  const refs: MediaUsageRef[] = [];
  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (raw?.includes(url)) {
      refs.push({ label: labelForKey(key), context: "Builder" });
    }
  }
  return refs;
}

export function getMediaUsageDetails(url: string): MediaUsageRef[] {
  const refs: MediaUsageRef[] = [];
  const normalized = url.trim();

  getAllProducts().forEach((cake) => {
    if (cake.image === normalized) {
      refs.push({ label: cake.name, context: "Storefront cake" });
    }
  });

  loadProducts().forEach((cake) => {
    if (cake.images.includes(normalized)) {
      refs.push({ label: cake.name, context: "Admin cake" });
    }
  });

  loadBanners().forEach((banner) => {
    if (banner.image === normalized) {
      refs.push({ label: banner.title, context: "Banner" });
    }
  });

  if (galleryImages.includes(normalized)) {
    refs.push({ label: "Gallery image", context: "Gallery" });
  }

  refs.push(
    ...scanStorageKeys(normalized, ["bakery-cms-homepage-draft", "bakery-cms-homepage-published"], (key) =>
      key.includes("published") ? "Homepage (published)" : "Homepage (draft)"
    )
  );

  refs.push(
    ...scanStorageKeys(normalized, ["bakery-cms-wedding-draft", "bakery-cms-wedding-published"], (key) =>
      key.includes("published") ? "Wedding page (published)" : "Wedding page (draft)"
    )
  );

  if (typeof window !== "undefined") {
    const productsRaw = localStorage.getItem("bakery-cms-admin-cakes");
    if (productsRaw) {
      try {
        const pattern = new RegExp(escapeRegex(normalized), "g");
        const matches = productsRaw.match(pattern);
        if (matches && matches.length > 0 && !refs.some((ref) => ref.context === "Admin cake")) {
          refs.push({ label: "Cake catalog", context: "Admin cakes JSON" });
        }
      } catch {
        // ignore regex issues
      }
    }
  }

  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.context}:${ref.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function countMediaUsage(url: string): number {
  return getMediaUsageDetails(url).length;
}
