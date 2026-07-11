import { routes } from "@/constants/routes";
import type { WeddingSectionInstance, WeddingSectionRegistryEntry, WeddingSectionType } from "@/types/wedding-builder";

export const WEDDING_SECTION_REGISTRY: WeddingSectionRegistryEntry[] = [
  {
    type: "wedding-hero",
    label: "Hero",
    icon: "Heart",
    defaultBackground: "white",
    defaultContent: {
      overline: "Forever Starts Here",
      title: "Celebrate Your Love Story",
      description:
        "From intimate ceremonies to grand receptions, our wedding cake studio creates bespoke designs tailored to your theme, colours, and guest count.",
      ctaLabel: "Request a Quote",
      ctaHref: "#inquiry",
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
    type: "wedding-why-us",
    label: "Why Choose Us",
    icon: "Shield",
    defaultBackground: "white",
    defaultContent: {
      title: "Why Choose Us",
      description: "Trusted by couples across India for unforgettable wedding celebrations.",
    },
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
    ],
  },
  {
    type: "wedding-offers",
    label: "Offers",
    icon: "Gift",
    defaultBackground: "cream",
    defaultContent: {
      title: "Wedding Offers",
      description: "Limited-time packages for couples planning their big day.",
      maxCount: 3,
    },
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max offers shown", type: "number" },
    ],
  },
  {
    type: "wedding-collections",
    label: "Collections",
    icon: "Cake",
    defaultBackground: "cream",
    defaultContent: {
      title: "Wedding Collections",
      description: "Explore signature tiers, flavours, and finishes for your celebration.",
      maxCount: 6,
    },
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max cakes shown", type: "number" },
    ],
  },
  {
    type: "wedding-gallery",
    label: "Gallery",
    icon: "Images",
    defaultBackground: "white",
    defaultContent: {
      overline: "Our Work",
      title: "Wedding Gallery",
      description: "A glimpse of celebrations we have been honoured to sweeten.",
      maxCount: 8,
      ctaLabel: "View Full Gallery",
      ctaHref: routes.store.gallery,
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max images shown", type: "number" },
      { key: "ctaLabel", label: "CTA label", type: "text" },
      { key: "ctaHref", label: "CTA link", type: "url" },
    ],
  },
  {
    type: "wedding-testimonials",
    label: "Testimonials",
    icon: "Quote",
    defaultBackground: "cream",
    defaultContent: {
      overline: "Love Letters",
      title: "What Couples Say",
      description: "Stories from weddings we were honoured to be part of.",
      maxCount: 2,
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max testimonials shown", type: "number" },
    ],
  },
  {
    type: "wedding-inquiry",
    label: "Inquiry Form",
    icon: "Mail",
    defaultBackground: "white",
    defaultContent: {
      title: "Wedding Inquiry",
      description:
        "Share your wedding date, venue, and vision. Our team will reach out within 24 hours.",
      note: "Complimentary tasting for orders above ₹15,000",
      submitLabel: "Submit Wedding Inquiry",
      defaultSubject: "Wedding cake inquiry",
    },
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "note", label: "Support note", type: "text" },
      { key: "submitLabel", label: "Submit button label", type: "text" },
      { key: "defaultSubject", label: "Default subject", type: "text" },
    ],
  },
  {
    type: "wedding-faq",
    label: "FAQ",
    icon: "HelpCircle",
    defaultBackground: "cream",
    defaultContent: {
      overline: "Planning Help",
      title: "Wedding FAQ",
      description: "Common questions about tasting, delivery, and custom designs.",
      maxItems: 5,
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxItems", label: "Max FAQ items", type: "number" },
    ],
  },
  {
    type: "wedding-cta",
    label: "Call to Action",
    icon: "Megaphone",
    defaultBackground: "white",
    defaultContent: {
      title: "Ready to Design Your Dream Cake?",
      description: "Book a consultation with our wedding specialists today.",
      ctaLabel: "Contact Us",
      ctaHref: routes.store.contact,
      showGalleryLink: true,
    },
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "ctaLabel", label: "CTA label", type: "text" },
      { key: "ctaHref", label: "CTA link", type: "url" },
      { key: "showGalleryLink", label: "Show gallery link", type: "boolean" },
    ],
  },
];

export function getWeddingRegistryEntry(
  type: WeddingSectionType
): WeddingSectionRegistryEntry | undefined {
  return WEDDING_SECTION_REGISTRY.find((entry) => entry.type === type);
}

export function createDefaultWeddingSections(): WeddingSectionInstance[] {
  return WEDDING_SECTION_REGISTRY.map((entry, index) => ({
    instanceId: `${entry.type}-${index}`,
    type: entry.type,
    order: index,
    isVisible: true,
    background: entry.defaultBackground,
    content: { ...entry.defaultContent },
  }));
}

export function createWeddingSectionInstance(
  type: WeddingSectionType,
  order: number
): WeddingSectionInstance {
  const entry = getWeddingRegistryEntry(type);
  if (!entry) {
    throw new Error(`Unknown wedding section type: ${type}`);
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
