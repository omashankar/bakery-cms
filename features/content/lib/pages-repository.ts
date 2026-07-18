import type { CmsPage, CmsPageFormData } from "@/types/content";
import { brandInfo } from "@/constants/landing-data";
import { slugify } from "@/features/products/lib/product-utils";
import { upsertSeoRouteForPath } from "@/features/seo/lib/seo-repository";
import { getStorefrontPageUrl } from "./pages-utils";

const STORAGE_KEY = "bakery-cms-pages";

function nowIso(): string {
  return new Date().toISOString();
}

function block(id: string, type: "paragraph" | "heading", content: string) {
  return { id, type, content };
}

function seedPages(): CmsPage[] {
  const timestamp = nowIso();

  return [
    {
      id: "page-about",
      title: "About Us",
      slug: "about",
      description: brandInfo.description,
      template: "about",
      heroImage:
        "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?w=1200&h=900&fit=crop",
      blocks: [
        block("about-1", "heading", brandInfo.tagline),
        block(
          "about-2",
          "paragraph",
          "From a single neighborhood store to a household name, Monginis has been part of celebrations for generations across India."
        ),
        block(
          "about-3",
          "paragraph",
          "Our bakers combine timeless recipes with modern craftsmanship to deliver cakes that look premium and taste unforgettable."
        ),
        block(
          "about-4",
          "paragraph",
          "We remain committed to consistent quality, hygienic kitchens, and delight in every bite — whether it's a birthday, wedding, or corporate event."
        ),
      ],
      status: "published",
      isSystem: true,
      sortOrder: 1,
      seo: {
        metaTitle: "About Us | Monginis",
        metaDescription: brandInfo.description,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "page-privacy",
      title: "Privacy Policy",
      slug: "privacy",
      description: "How we collect, use, and protect your information.",
      template: "standard",
      blocks: [
        block(
          "privacy-1",
          "paragraph",
          "We collect only essential details required to process orders, deliver cakes, and provide customer support. This may include your name, email address, phone number, and delivery address."
        ),
        block(
          "privacy-2",
          "paragraph",
          "Your contact information is never sold to third parties. Payment processing is handled by secure, PCI-compliant providers. We retain order data only as long as necessary for fulfillment and legal compliance."
        ),
        block(
          "privacy-3",
          "paragraph",
          "By using this website, you consent to data usage for order fulfillment, service updates, and communication related to your inquiries. You may request access to or deletion of your personal data by contacting us."
        ),
        block(
          "privacy-4",
          "paragraph",
          "We use cookies to improve site performance and remember your preferences. You can disable cookies in your browser settings, though some features may not function correctly."
        ),
      ],
      status: "published",
      isSystem: true,
      sortOrder: 2,
      seo: {
        metaTitle: "Privacy Policy | Monginis",
        metaDescription: "How we collect, use, and protect your information.",
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "page-terms",
      title: "Terms of Service",
      slug: "terms",
      description: "Terms and conditions for using our bakery services.",
      template: "standard",
      blocks: [
        block(
          "terms-1",
          "paragraph",
          "Orders are confirmed after we review your inquiry and provide a final quote. Custom cake orders require a deposit before preparation begins. Cancellation policies vary by product type and preparation stage."
        ),
        block(
          "terms-2",
          "paragraph",
          "Customized and wedding cakes are non-refundable once design approval and preparation have started. Delivery times are estimates and may vary due to traffic, weather, or high-demand periods."
        ),
        block(
          "terms-3",
          "paragraph",
          "Product images are representative. Minor variations in decoration may occur while maintaining the agreed design and quality standards. Allergen information is provided on request — please inform us of dietary restrictions when placing an order."
        ),
        block(
          "terms-4",
          "paragraph",
          "Use of this site implies acceptance of all terms listed here and any related policy updates published on this page."
        ),
      ],
      status: "published",
      isSystem: true,
      sortOrder: 3,
      seo: {
        metaTitle: "Terms of Service | Monginis",
        metaDescription: "Terms and conditions for using our bakery services.",
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "page-catering",
      title: "Corporate Catering",
      slug: "corporate-catering",
      description: "Premium pastries and celebration cakes for offices and events.",
      template: "standard",
      blocks: [
        block(
          "catering-1",
          "heading",
          "Celebrations at scale"
        ),
        block(
          "catering-2",
          "paragraph",
          "From boardroom meetings to annual day celebrations, Monginis offers curated dessert spreads, branded cupcakes, and custom cakes for corporate clients."
        ),
        block(
          "catering-3",
          "paragraph",
          "Contact our team for bulk pricing, vegetarian options, and scheduled delivery across metro cities."
        ),
      ],
      status: "draft",
      isSystem: false,
      sortOrder: 4,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
}

function persist(pages: CmsPage[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
}

export function loadPages(): CmsPage[] {
  if (typeof window === "undefined") return seedPages();

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = seedPages();
    persist(seeded);
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as CmsPage[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seedPages();
  } catch {
    return seedPages();
  }
}

export function getPublishedPages(): CmsPage[] {
  return loadPages()
    .filter((page) => page.status === "published")
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getPageById(id: string): CmsPage | null {
  return loadPages().find((page) => page.id === id) ?? null;
}

export function getPageBySlug(slug: string): CmsPage | null {
  return loadPages().find((page) => page.slug === slug) ?? null;
}

export function getPublishedPageBySlug(slug: string): CmsPage | null {
  const page = getPageBySlug(slug);
  return page?.status === "published" ? page : null;
}

export function getPageForStorefront(slug: string, preview = false): CmsPage | null {
  const page = getPageBySlug(slug);
  if (!page) return null;
  if (preview) return page;
  return page.status === "published" ? page : null;
}

export function processScheduledPagePublishes(): number {
  const pages = loadPages();
  const now = Date.now();
  let count = 0;

  const next = pages.map((page) => {
    if (
      page.scheduledPublishAt &&
      page.status !== "published" &&
      new Date(page.scheduledPublishAt).getTime() <= now
    ) {
      count += 1;
      return {
        ...page,
        status: "published" as const,
        scheduledPublishAt: undefined,
        updatedAt: nowIso(),
      };
    }
    return page;
  });

  if (count > 0) persist(next);
  return count;
}

export function createEmptyPageForm(): CmsPageFormData {
  return {
    title: "",
    slug: "",
    description: "",
    template: "standard",
    blocks: [block(`block-${Date.now()}`, "paragraph", "")],
    heroImage: "",
    status: "draft",
    isSystem: false,
    sortOrder: loadPages().length + 1,
    seo: {
      metaTitle: "",
      metaDescription: "",
    },
  };
}

export function createPage(data: CmsPageFormData): CmsPage {
  const pages = loadPages();
  const timestamp = nowIso();
  const created: CmsPage = {
    ...data,
    slug: slugify(data.slug || data.title),
    id: `page-${Date.now()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  persist([...pages, created]);
  return created;
}

export function updatePage(id: string, patch: Partial<CmsPageFormData>): CmsPage | null {
  const pages = loadPages();
  const index = pages.findIndex((page) => page.id === id);
  if (index === -1) return null;

  const current = pages[index];
  const updated: CmsPage = {
    ...current,
    ...patch,
    slug: patch.slug ? slugify(patch.slug) : current.slug,
    id,
    isSystem: current.isSystem,
    updatedAt: nowIso(),
  };
  pages[index] = updated;
  persist(pages);

  if (updated.status === "published") {
    upsertSeoRouteForPath(getStorefrontPageUrl(updated.slug), updated.title, {
      metaTitle: updated.seo?.metaTitle ?? `${updated.title} | Monginis`,
      metaDescription: updated.seo?.metaDescription ?? updated.description,
      metaKeywords: updated.seo?.metaKeywords ?? [],
      ogImage: updated.seo?.ogImage,
      noIndex: updated.seo?.noIndex ?? false,
      noFollow: updated.seo?.noFollow ?? false,
    });
  }

  return updated;
}

export function deletePages(ids: string[]): number {
  const pages = loadPages();
  const next = pages.filter((page) => !ids.includes(page.id) || page.isSystem);
  const count = pages.length - next.length;
  persist(next);
  return count;
}

export function bulkUpdatePageStatus(ids: string[], status: CmsPage["status"]): number {
  const pages = loadPages();
  let count = 0;
  const next = pages.map((page) => {
    if (!ids.includes(page.id)) return page;
    count += 1;
    return { ...page, status, updatedAt: nowIso() };
  });
  persist(next);
  return count;
}
