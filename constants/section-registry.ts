import { brandInfo, contactInfo } from "@/constants/landing-data";
import { demoPhotoIds, unsplash } from "@/constants/demo-images";
import { routes } from "@/constants/routes";
import type {
  HeroSlideContent,
  HomepageSectionInstance,
  HomepageSectionType,
  SectionBackground,
  SectionFieldDef,
} from "@/types/homepage-builder";

export interface HomepageSectionRegistryEntry {
  type: HomepageSectionType;
  label: string;
  icon: string;
  defaultBackground: SectionBackground;
  defaultContent: Record<string, string | number | boolean>;
  fields: SectionFieldDef[];
}

/** Seed slides for a fresh hero carousel — all editable in the builder. */
export const DEFAULT_HERO_SLIDES: HeroSlideContent[] = [
  {
    badge: "Since 1965 · India's Favourite Bakery",
    headline: brandInfo.tagline,
    subtext: brandInfo.description,
    primaryLabel: "Shop Cakes",
    primaryHref: routes.store.collections,
    secondaryLabel: "Wedding Collection",
    secondaryHref: routes.store.weddingCakes,
    imageUrl: unsplash(demoPhotoIds.blushCake, 800, 1000),
  },
  {
    badge: "Limited Time",
    headline: "Summer Celebration Sale",
    subtext: "Up to 25% off our seasonal favourites — this week only.",
    primaryLabel: "Shop the Sale",
    primaryHref: routes.store.collections,
    secondaryLabel: "View Menu",
    secondaryHref: routes.store.collections,
    imageUrl: unsplash(demoPhotoIds.chocolateCake, 800, 1000),
  },
  {
    badge: "Bespoke Cakes",
    headline: "Wedding Season Special",
    subtext: "Book a tasting and design a custom tiered cake for your big day.",
    primaryLabel: "Explore Wedding Cakes",
    primaryHref: routes.store.weddingCakes,
    secondaryLabel: "Enquire",
    secondaryHref: routes.store.contact,
    imageUrl: unsplash(demoPhotoIds.weddingCake, 800, 1000),
  },
];

/**
 * Read hero slides from a section's content. Falls back to the legacy flat
 * fields (badge/headline/ctaPrimary…) so hero sections saved before the
 * multi-slide upgrade still render as a single slide.
 */
export function parseHeroSlides(
  content: Record<string, string | number | boolean>
): HeroSlideContent[] {
  const raw = content.slides;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (slide): slide is HeroSlideContent =>
            Boolean(slide) && typeof slide === "object"
        );
      }
    } catch {
      // fall through to legacy migration
    }
  }

  const headline = String(content.headline ?? "");
  const imageUrl = String(content.imageUrl ?? "");
  if (headline || imageUrl) {
    return [
      {
        badge: String(content.badge ?? ""),
        headline,
        subtext: String(content.subtext ?? ""),
        primaryLabel: String(content.ctaPrimaryLabel ?? ""),
        primaryHref: String(content.ctaPrimaryHref ?? ""),
        secondaryLabel: String(content.ctaSecondaryLabel ?? ""),
        secondaryHref: String(content.ctaSecondaryHref ?? ""),
        imageUrl,
      },
    ];
  }

  return [];
}

export const HOMEPAGE_SECTION_REGISTRY: HomepageSectionRegistryEntry[] = [
  {
    type: "hero",
    label: "Hero",
    icon: "Sparkles",
    defaultBackground: "white",
    defaultContent: {
      slides: JSON.stringify(DEFAULT_HERO_SLIDES),
    },
    fields: [{ key: "slides", label: "Hero slides", type: "slides" }],
  },
  {
    type: "our-menu",
    label: "Menu Strip",
    icon: "LayoutGrid",
    defaultBackground: "white",
    defaultContent: {
      overline: "Explore",
      title: "Our Menu",
      description: "Shop by category — cakes, pastries, chocolates, and more.",
      maxCount: 8,
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max categories shown", type: "number" },
    ],
  },
  {
    type: "promo-banner",
    label: "Promo Banner",
    icon: "Tag",
    defaultBackground: "cream",
    defaultContent: {
      overline: "Limited Time",
      title: "Summer Celebration Sale",
      description: "Up to 20% off on selected celebration cakes this week.",
      ctaLabel: "Shop Offers",
      ctaHref: routes.store.collections,
      maxCount: 2,
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "ctaLabel", label: "CTA label", type: "text" },
      { key: "ctaHref", label: "CTA link", type: "url" },
      { key: "maxCount", label: "Max banners shown", type: "number" },
    ],
  },
  {
    type: "categories",
    label: "Featured Categories",
    icon: "LayoutGrid",
    defaultBackground: "cream",
    defaultContent: {
      overline: "Browse by Occasion",
      title: "Featured Categories",
      description:
        "Find the perfect cake for every celebration — birthdays, weddings, anniversaries, and more.",
      maxCount: 6,
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max categories shown", type: "number" },
    ],
  },
  {
    type: "featured-cakes",
    label: "Featured Cakes",
    icon: "Star",
    defaultBackground: "white",
    defaultContent: {
      overline: "Handpicked Favourites",
      title: "Featured Cakes",
      description:
        "Our most loved creations, crafted with premium ingredients and decades of expertise.",
      maxCount: 4,
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max cakes shown", type: "number" },
    ],
  },
  {
    type: "trending",
    label: "Trending Cakes",
    icon: "TrendingUp",
    defaultBackground: "cream",
    defaultContent: {
      overline: "What's Hot",
      title: "Trending Now",
      description: "The cakes everyone is talking about this season.",
      maxCount: 4,
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max cakes shown", type: "number" },
    ],
  },
  {
    type: "best-sellers",
    label: "Best Sellers",
    icon: "Award",
    defaultBackground: "white",
    defaultContent: {
      overline: "Customer Favourites",
      title: "Best Sellers",
      description: "Tried, tested, and loved by thousands of happy customers.",
      maxCount: 4,
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max cakes shown", type: "number" },
    ],
  },
  {
    type: "offers",
    label: "Special Offers",
    icon: "Tag",
    defaultBackground: "cream",
    defaultContent: {
      overline: "Limited Time",
      title: "Special Offers",
      description: "Sweet deals you don't want to miss. Grab them before they're gone!",
      maxCount: 3,
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max offers shown", type: "number" },
    ],
  },
  {
    type: "wedding",
    label: "Wedding Collection",
    icon: "Heart",
    defaultBackground: "cream",
    defaultContent: {
      overline: "Forever Starts Here",
      title: "Wedding Collection",
      description:
        "Bespoke wedding cakes designed to make your special day unforgettable.",
      ctaLabel: "View Wedding Cakes",
      ctaHref: routes.store.weddingCakes,
      imageUrl:
        "https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=600&h=800&fit=crop",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "ctaLabel", label: "CTA label", type: "text" },
      { key: "ctaHref", label: "CTA link", type: "url" },
      { key: "imageUrl", label: "Image URL", type: "url", isImage: true },
    ],
  },
  {
    type: "photo-cakes",
    label: "Photo Cakes",
    icon: "Camera",
    defaultBackground: "white",
    defaultContent: {
      overline: "Personalised",
      title: "Photo Cakes",
      description: "Turn your favourite memories into delicious edible art.",
      maxCount: 4,
      ctaLabel: "Shop Photo Cakes",
      ctaHref: routes.store.collection("photo-cakes"),
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max cakes shown", type: "number" },
      { key: "ctaLabel", label: "CTA label", type: "text" },
      { key: "ctaHref", label: "CTA link", type: "url" },
    ],
  },
  {
    type: "eggless",
    label: "Eggless Cakes",
    icon: "Leaf",
    defaultBackground: "cream",
    defaultContent: {
      overline: "100% Eggless",
      title: "Eggless Collection",
      description: "Every bit as delicious — crafted without eggs for all celebrations.",
      maxCount: 4,
      ctaLabel: "Shop Eggless",
      ctaHref: routes.store.collection("eggless"),
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max cakes shown", type: "number" },
      { key: "ctaLabel", label: "CTA label", type: "text" },
      { key: "ctaHref", label: "CTA link", type: "url" },
    ],
  },
  {
    type: "seasonal",
    label: "Seasonal Collection",
    icon: "Sun",
    defaultBackground: "white",
    defaultContent: {
      overline: "This Season",
      title: "Seasonal Collection",
      description: "Limited-edition flavours inspired by the season's finest ingredients.",
      maxCount: 4,
      ctaLabel: "Shop Seasonal",
      ctaHref: routes.store.collection("seasonal"),
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max cakes shown", type: "number" },
      { key: "ctaLabel", label: "CTA label", type: "text" },
      { key: "ctaHref", label: "CTA link", type: "url" },
    ],
  },
  {
    type: "why-us",
    label: "Why Choose Us",
    icon: "Shield",
    defaultBackground: "white",
    defaultContent: {
      overline: "The Monginis Difference",
      title: "Why Choose Us",
      description:
        "Six decades of trust, quality, and the sweetest memories for every celebration.",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
    ],
  },
  {
    type: "testimonials",
    label: "Testimonials",
    icon: "Quote",
    defaultBackground: "cream",
    defaultContent: {
      overline: "Love Letters",
      title: "What Our Customers Say",
      description: "Real stories from real celebrations across India.",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
    ],
  },
  {
    type: "gallery",
    label: "Gallery",
    icon: "Images",
    defaultBackground: "white",
    defaultContent: {
      overline: "Sweet Inspiration",
      title: "Gallery",
      description: "A glimpse into our world of cakes, pastries, and celebrations.",
      ctaLabel: "View Full Gallery",
      ctaHref: routes.store.gallery,
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "ctaLabel", label: "CTA label", type: "text" },
      { key: "ctaHref", label: "CTA link", type: "url" },
    ],
  },
  {
    type: "instagram",
    label: "Instagram Gallery",
    icon: "Camera",
    defaultBackground: "cream",
    defaultContent: {
      overline: "Follow Us",
      title: "On Instagram",
      description: "@monginisofficial — daily inspiration and behind-the-scenes sweetness.",
      instagramHandle: "monginisofficial",
      instagramUrl: "https://instagram.com",
      maxCount: 6,
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "instagramHandle", label: "Instagram handle", type: "text" },
      { key: "instagramUrl", label: "Instagram URL", type: "url" },
      { key: "maxCount", label: "Max posts shown", type: "number" },
    ],
  },
  {
    type: "store-locator",
    label: "Store Locator",
    icon: "MapPin",
    defaultBackground: "cream",
    defaultContent: {
      overline: "Visit Us",
      title: "Find a Store Near You",
      description:
        "Over 300 outlets across India — freshly baked treats, always close by.",
      buttonLabel: "Find Stores",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "buttonLabel", label: "Button label", type: "text" },
    ],
  },
  {
    type: "newsletter",
    label: "Newsletter",
    icon: "Mail",
    defaultBackground: "white",
    defaultContent: {
      title: "Stay in the Loop",
      description:
        "Subscribe for exclusive offers, new cake launches, and seasonal specials delivered to your inbox.",
      buttonLabel: "Subscribe",
      disclaimer: "No spam. Unsubscribe anytime.",
    },
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "buttonLabel", label: "Button label", type: "text" },
      { key: "disclaimer", label: "Disclaimer", type: "text" },
    ],
  },
  {
    type: "cta",
    label: "Call to Action",
    icon: "Megaphone",
    defaultBackground: "white",
    defaultContent: {
      overline: "Get in Touch",
      title: "Ready to Order Your Perfect Cake?",
      description:
        "Whether it's a birthday surprise, wedding centerpiece, or corporate celebration — our team is here to help.",
      ctaLabel: "Contact Us",
      ctaHref: routes.store.contact,
      showPhone: true,
      phone: contactInfo.phone,
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "ctaLabel", label: "CTA label", type: "text" },
      { key: "ctaHref", label: "CTA link", type: "url" },
      { key: "showPhone", label: "Show phone button", type: "boolean" },
      { key: "phone", label: "Phone number", type: "text" },
    ],
  },
];

export function getRegistryEntry(
  type: HomepageSectionType
): HomepageSectionRegistryEntry | undefined {
  return HOMEPAGE_SECTION_REGISTRY.find((entry) => entry.type === type);
}

export function createDefaultHomepageSections(): HomepageSectionInstance[] {
  return HOMEPAGE_SECTION_REGISTRY.map((entry, index) => ({
    instanceId: `${entry.type}-${index}`,
    type: entry.type,
    order: index,
    isVisible: true,
    background: entry.defaultBackground,
    content: { ...entry.defaultContent },
  }));
}

export function createSectionInstance(
  type: HomepageSectionType,
  order: number
): HomepageSectionInstance {
  const entry = getRegistryEntry(type);
  if (!entry) {
    throw new Error(`Unknown section type: ${type}`);
  }
  return {
    instanceId: `${type}-${Date.now()}`,
    type,
    order,
    isVisible: true,
    background: entry.defaultBackground,
    content: { ...entry.defaultContent },
  };
}
