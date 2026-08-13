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

/**
 * Read a `type: "list"` field from a section's content.
 *
 * Stored as a JSON string for the same reason `slides` is: content values are
 * primitives, and `contentIsUsable` rejects anything else with a 400.
 *
 * Returns [] for anything it cannot read — an absent key, malformed JSON, a
 * value that is not an array. NEVER a default: these lists hold claims about
 * the shop, and a fallback would re-assert the demo copy on every section
 * saved before the field existed, which is the defect this exists to fix.
 *
 * A FAITHFUL read: rows come back exactly as stored, blanks and all.
 *
 * It used to drop all-empty rows and trim every value here, which broke the
 * editor in two ways. The editor holds no draft of its own — it re-reads
 * through this function on every render — so "Add row" wrote an empty row and
 * this filter deleted it before it could be typed into, making the button a
 * no-op on every list field. And clearing a row's last non-empty column
 * deleted the row out from under the cursor. Trimming did the same to a
 * trailing space, which a controlled input cannot then display.
 *
 * Deciding what is worth SHOWING belongs to the renderer, which is what
 * `renderableRows` below is for.
 */
export function parseListField(
  content: Record<string, string | number | boolean>,
  key: string,
): Record<string, string>[] {
  const raw = content[key];
  if (typeof raw !== "string" || !raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
      .map((row) => {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(row)) {
          out[k] = typeof v === "string" ? v : v == null ? "" : String(v);
        }
        return out;
      });
  } catch {
    return [];
  }
}

/**
 * The rows a page should actually render.
 *
 * A row with nothing in any column says nothing, and an admin mid-edit leaves
 * exactly that behind. Storefront renderers filter here rather than in
 * `parseListField`, so the editor keeps its blank rows and the page does not
 * show them.
 */
export function renderableRows(rows: Record<string, string>[]): Record<string, string>[] {
  return rows.filter((row) => Object.values(row).some((value) => value.trim() !== ""));
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
    fields: [
      { key: "slides", label: "Hero slides", type: "slides" },
      {
        /**
         * The strip under the hero. It was a constant reading "1M+ Happy
         * customers · 500+ Cake varieties · 60+ Years of joy" — the demo
         * brand's figures, shown as whichever shop runs this CMS. Empty by
         * default, and an empty list renders no strip at all.
         */
        key: "stats",
        label: "Stats strip",
        type: "list",
        emptyHint: "No stats — the strip will not appear on the page.",
        itemFields: [
          { key: "value", label: "Figure", type: "text", placeholder: "500+" },
          { key: "label", label: "Label", type: "text", placeholder: "Cakes baked" },
        ],
      },
    ],
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
        "https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=900&h=900&fit=crop&q=80",
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
      // Seeded without the demo brand's name or its "six decades" — a new shop
      // should not have to delete someone else's history before it can write
      // its own.
      overline: "",
      title: "Why Choose Us",
      description: "",
    },
    fields: [
      {
        /**
         * The four cards were a hardcoded array inside the renderer: "Over six
         * decades of baking expertise", "Belgian chocolate", "Order by 2 PM for
         * same-day delivery across major cities". None of it is true of every
         * shop, and the delivery line contradicted the shop's own lead time.
         */
        key: "items",
        label: "Cards",
        type: "list",
        emptyHint: "No cards — this section will not appear on the page.",
        itemFields: [
          {
            key: "icon",
            label: "Icon",
            type: "select",
            options: [
              { label: "Award", value: "Award" },
              { label: "Leaf", value: "Leaf" },
              { label: "Truck", value: "Truck" },
              { label: "Palette", value: "Palette" },
            ],
          },
          { key: "title", label: "Title", type: "text", placeholder: "Premium Ingredients" },
          { key: "description", label: "Description", type: "text" },
        ],
      },
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
      {
        /**
         * The shop's OWN photographs.
         *
         * This grid rendered `galleryImages` from landing-data — twelve stock
         * Unsplash photos of somebody else's cakes, shown as this shop's work on
         * every install, with no field anywhere to change them. A customer
         * choosing a bakery by its photographs was choosing on someone else's.
         *
         * Empty renders no grid: a section that admits it has no photos yet is
         * better than one showing another bakery's.
         */
        key: "images",
        label: "Photos",
        type: "list",
        emptyHint: "No photos — this section will not appear on the page.",
        itemFields: [
          { key: "image", label: "Photo", type: "url", isImage: true },
          { key: "title", label: "Caption", type: "text" },
          { key: "tag", label: "Tag", type: "text", placeholder: "Wedding" },
        ],
      },
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
      description: "Daily inspiration and behind-the-scenes sweetness.",
      // No handle or URL seeded on purpose: left unset, the section uses the
      // shop's own Instagram from Settings → Social. Baking the demo account in
      // here meant a shop that had configured its real profile still advertised
      // someone else's across seven links and a "Follow @…" button.
      maxCount: 6,
    },
    fields: [
      {
        /**
         * The shop's own posts, if it wants to show any.
         *
         * This rendered six stock photos from `instagramPosts` as though they
         * were the shop's feed — under a heading naming the shop's real handle,
         * and each one linking to that profile. So the strip invited a customer
         * to a feed that looked nothing like the tiles above it.
         *
         * There is no Instagram API here and none is being added: these are
         * pictures the shop uploads, and the section disappears without them.
         */
        key: "posts",
        label: "Posts",
        type: "list",
        emptyHint: "No posts — this section will not appear on the page.",
        itemFields: [{ key: "image", label: "Photo", type: "url", isImage: true }],
      },
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
    // Was "Find a Store Near You" / "Over 300 outlets across India" / "Find
    // Stores" — copy for a chain, shipped to every shop that installs this CMS,
    // above a locator that searched nothing and listed three fixed Mumbai
    // addresses. This CMS stores one address; the section shows it.
    defaultContent: {
      overline: "Visit Us",
      title: "Visit Our Bakery",
      description: "Here is where to find us, and when we are open.",
      buttonLabel: "Get Directions",
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
