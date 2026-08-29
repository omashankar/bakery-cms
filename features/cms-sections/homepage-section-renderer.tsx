"use client";

import { OptimizedImage } from "@/components/shared/optimized-image";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Camera,
  Clock,
  Heart,
  Leaf,
  Mail,
  MapPin,
  Phone,
  Quote,
  Send,
  Store,
  Tag,
  Truck,
  Palette,
} from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { SectionHeader } from "@/components/shared/section-header";
import { RatingStars } from "@/components/shared/rating-stars";
import { ScrollReveal, StaggerReveal } from "@/components/shared/scroll-reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  weddingCakes,
  type LandingCategory,
  type LandingOffer,
  type LandingProduct,
} from "@/constants/landing-data";
import { routes } from "@/constants/routes";
import { getActivePromoBanners } from "@/features/content/lib/banners-repository";
import type { Banner } from "@/types/media";
import {
  limitRows,
  parseHeroSlides,
  parseListField,
  photoRows,
  renderableRows,
} from "@/constants/section-registry";
import { HeroCarousel, type HeroSlide } from "./hero-carousel";
import {
  getStorefrontFaqs,
  getStorefrontTestimonials,
  selectStorefrontFaqs,
  selectStorefrontTestimonials,
} from "@/features/content/lib/storefront-content";
import {
  getHomepageProducts,
  type HomepageProductSource,
  getHomepageCategories,
  getHomepageOffers,
} from "@/features/products/lib/homepage-catalog";
import { layoutSpacing } from "@/constants/spacing";
import type { HomepageSectionInstance } from "@/types/homepage-builder";
import type { FaqItem, Testimonial } from "@/types/content";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import {
  isWeddingEnabled,
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";
import { isSafeSocialUrl } from "@/features/settings/lib/settings-utils";
import { toast } from "sonner";
import { addNewsletterSubscriber } from "@/features/inquiries/lib/newsletter-repository";
import { formatCurrency } from "@/utils/format";

interface HomepageSectionRendererProps {
  section: HomepageSectionInstance;
  /**
   * Product rails built on the server. When absent (admin builder preview) the
   * renderer falls back to the browser catalogue.
   */
  rails?: Partial<Record<HomepageProductSource, LandingProduct[]>>;
  /**
   * Active hero banners read on the server. When absent (admin builder preview)
   * the promo section falls back to the browser banner store.
   */
  banners?: Banner[];
  /**
   * Categories read on the server. When absent (admin builder preview) the
   * category sections fall back to the browser catalogue.
   */
  categories?: LandingCategory[];
  /** Raw testimonials + faq read on the server (absent in the builder preview). */
  testimonials?: Testimonial[];
  faqs?: FaqItem[];
  /**
   * The shop's live coupons as offer cards, read on the server. When absent
   * (admin builder preview) the offers section falls back to the browser coupon
   * cache. It never falls back to the hardcoded demo offers — see
   * features/commerce/lib/coupon-offers.ts for why.
   */
  offers?: LandingOffer[];
  /**
   * The shop's real address, phone and hours from Settings → Contact, read on
   * the server. Absent in the builder preview, where the locator says so rather
   * than inventing outlets.
   */
  storeLocation?: {
    address: string;
    phone: string;
    mapUrl: string;
    hours: { day: string; hours: string }[];
  } | null;
  /**
   * The shop's Instagram from Settings → Social, read on the server. Absent in
   * the admin builder preview, where the section falls back to its own content.
   */
  instagram?: { url: string; handle: string } | null;
  /**
   * The shop's own rating, delivery speed and free-delivery threshold, read on
   * the server.
   *
   * These were constants — "4.9 Rating · 2000+ reviews", "Same-Day Delivery",
   * "On orders over ₹999" — and every one of them is a figure this CMS already
   * stores, so each was a stale second copy of an answer the shop had already
   * given. Absent in the builder preview, where each tile shows its label with
   * no figure rather than inventing one.
   */
  trust?: {
    freeDeliveryThreshold: number;
    deliveryPromise: string;
    rating: { count: number; average: number } | null;
  } | null;
  selected?: boolean;
  onSelect?: () => void;
  interactive?: boolean;
  /** Render only the inner card (no full-width section wrapper) so it can share a row. */
  embedded?: boolean;
}

function contentString(
  content: HomepageSectionInstance["content"],
  key: string,
  fallback = ""
): string {
  const value = content[key];
  return typeof value === "string" ? value : fallback;
}

function contentNumber(
  content: HomepageSectionInstance["content"],
  key: string,
  fallback: number
): number {
  const value = content[key];
  return typeof value === "number" ? value : Number(value) || fallback;
}

function contentBoolean(
  content: HomepageSectionInstance["content"],
  key: string,
  fallback = false
): boolean {
  const value = content[key];
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function SectionShell({
  section,
  selected,
  onSelect,
  interactive,
  children,
  className,
  noReveal,
}: HomepageSectionRendererProps & {
  children: React.ReactNode;
  className?: string;
  noReveal?: boolean;
}) {
  /**
   * The Background setting, and the ONLY place a section background is decided.
   *
   * This is applied before the caller's `className`, so any `bg-*` or
   * `surface-*` a section passes there outranks it — and three sections did,
   * which meant their Background dropdown was inert. The Wedding Collection
   * section showed "White" in the builder while rendering cream, on the page and
   * in the preview, and changing the dropdown did nothing.
   *
   * A section may override its PADDING here. It may not override its background.
   */
  const bgClass = section.background === "cream" ? "surface-cream" : "bg-white";
  // Hero runs its own entrance; the builder preview must stay fully visible while editing.
  // noReveal: the section reveals its own parts (e.g. staggered card grids).
  const revealOnScroll = !interactive && section.type !== "hero" && !noReveal;

  return (
    <section
      data-section-id={section.instanceId}
      onClick={interactive ? onSelect : undefined}
      className={cn(
        "scroll-mt-4 border-2 border-transparent transition-premium",
        bgClass,
        layoutSpacing.sectionY,
        interactive && "cursor-pointer hover:border-bakery-200",
        selected && "border-bakery-500 ring-2 ring-bakery-200",
        className
      )}
    >
      <div className={layoutSpacing.container}>
        {revealOnScroll ? <ScrollReveal>{children}</ScrollReveal> : children}
      </div>
    </section>
  );
}

/**
 * The trust bar, with its two figures taken from the shop.
 *
 * It read "Free Delivery · On orders over ₹999" and "Same-Day Delivery · Order
 * today, get today" as constants. The threshold is `freeDeliveryThreshold` and
 * the speed is `deliveryLeadDays`, both stored — and on this shop the second
 * was simply false: lead days is 1, so it cannot deliver same-day. The ₹999
 * happened to match today's setting, which is worse, not better: it would have
 * gone on saying ₹999 the moment an admin changed it.
 *
 * "Since 1956" is a claim with nothing behind it — and it disagreed with the
 * "Since 1965" in the hero badge a few hundred pixels above. It goes; the tile
 * keeps its title.
 */
function heroTrustBarFor(trust: HomepageSectionRendererProps["trust"]) {
  const freeDelivery =
    trust == null
      ? ""
      : trust.freeDeliveryThreshold > 0
        ? `On orders over ${formatCurrency(trust.freeDeliveryThreshold)}`
        : "On every order";

  return [
    { icon: "Truck", title: "Free Delivery", subtitle: freeDelivery },
    { icon: "Clock", title: trust?.deliveryPromise ?? "Delivery", subtitle: "" },
    { icon: "BadgeCheck", title: "100% Quality", subtitle: "Premium ingredients" },
    { icon: "Heart", title: "Made with Love", subtitle: "" },
  ] as const;
}

const heroTrustIcons = { Truck, Clock, BadgeCheck, Heart } as const;

function HeroSection(props: HomepageSectionRendererProps) {
  const { section } = props;

  const slides: HeroSlide[] = parseHeroSlides(section.content)
    .map((slide) => ({
      badge: slide.badge?.trim() || undefined,
      headline: slide.headline ?? "",
      subtext: slide.subtext?.trim() || undefined,
      primaryLabel: slide.primaryLabel?.trim() || "Shop Cakes",
      primaryHref: slide.primaryHref?.trim() || routes.store.collections,
      secondaryLabel: slide.secondaryLabel?.trim() || undefined,
      secondaryHref: slide.secondaryHref?.trim() || undefined,
      imageUrl: slide.imageUrl ?? "",
    }))
    .filter((slide) => slide.headline || slide.imageUrl);

  return (
    <SectionShell {...props} className="py-10 sm:py-12 lg:py-16">
      <HeroCarousel
        slides={slides}
        rating={props.trust?.rating ?? null}
        stats={renderableRows(parseListField(props.section.content, "stats"))}
      />

      <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-5 rounded-2xl border border-border bg-cream-50 p-5 sm:mt-12 sm:gap-6 sm:p-6 lg:grid-cols-4">
        {heroTrustBarFor(props.trust).map((item) => {
          const Icon = heroTrustIcons[item.icon as keyof typeof heroTrustIcons];
          return (
            <div key={item.title} className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-white text-bakery-700 shadow-sm">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                {item.subtitle ? (
                  <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

function OurMenuSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const maxCount = contentNumber(c, "maxCount", 8);
  const items = (props.categories ?? getHomepageCategories(maxCount)).slice(0, maxCount);

  if (items.length === 0) return null;

  return (
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
        description={contentString(c, "description")}
      />
      <div className="mt-8 flex snap-x gap-5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-4 sm:gap-6 sm:overflow-visible lg:grid-cols-8 [&::-webkit-scrollbar]:hidden">
        {items.map((category) => (
          <Link
            key={category.id}
            href={routes.store.collection(category.slug)}
            className="group flex w-20 shrink-0 snap-start flex-col items-center gap-2.5 sm:w-auto"
          >
            <div className="relative aspect-square w-20 overflow-hidden rounded-full border border-border bg-cream-100 transition-premium group-hover:border-bakery-300 group-hover:shadow-sm sm:w-full">
              {category.image ? (
                <OptimizedImage
                  src={category.image}
                  alt={category.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="120px"
                />
              ) : null}
            </div>
            <p className="line-clamp-2 text-center text-xs font-medium text-foreground group-hover:text-bakery-700">
              {category.name}
            </p>
          </Link>
        ))}
      </div>
    </SectionShell>
  );
}

/**
 * Where to find the shop.
 *
 * This section used to be entirely fictional. A pincode box waited 600ms and
 * toasted "Stores found — showing outlets near <whatever they typed>" having
 * searched nothing, beside three hardcoded Mumbai outlets at fixed distances of
 * 1.2 / 3.5 / 6.8 km. A customer in Delhi was told three shops in Mumbai were
 * around the corner. The NewsletterSection further down this same file was fixed
 * for exactly this — a form that said "Subscribed!" and wrote nothing — and the
 * fix stopped at that form.
 *
 * There is no outlet list in this CMS to search: Settings → Contact holds one
 * address, one phone and one set of opening hours. So this shows those, and the
 * search that never happened is gone.
 */
function StoreLocatorSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const location = props.storeLocation ?? null;

  // The heading, description and button label are the admin's own words, shown
  // as typed. An earlier attempt here swapped the shipped copy at render time,
  // which meant an admin who deliberately typed "Find a Store Near You" saw
  // something else on the storefront — and saw it differ from their own editor
  // field two inches away in the builder preview. The seeded wording is fixed
  // where it belongs, in the registry defaults, so new sections and resets get
  // honest copy and existing content stays the admin's.
  const title = contentString(c, "title");
  const description = contentString(c, "description");
  const buttonLabel = contentString(c, "buttonLabel", "Get Directions");

  // Nothing to show means nothing to show. Rendering the heading alone left a
  // shop advertising "Find a Store Near You" above an empty panel — the seeded
  // copy is still in most stored layouts, so on a shop that has not filled in
  // its address that heading is the last thing that should survive. The builder
  // says why instead, so the admin is not left guessing.
  if (!location) {
    if (!props.interactive) return null;
    return (
      <SectionShell {...props}>
        <div className="rounded-2xl border border-dashed border-border bg-white p-6 text-center text-sm text-muted-foreground sm:p-8">
          This section shows your shop&apos;s address and opening hours from
          Settings → Contact. Until you set a real address there it stays hidden
          on the live homepage — the shipped example address is in Mumbai.
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell {...props}>
      <div className="grid gap-8 rounded-2xl border border-border bg-white p-6 sm:p-8 lg:grid-cols-2 lg:items-center lg:gap-12">
        <div className="space-y-5">
          <div className="flex size-12 items-center justify-center rounded-xl bg-cream-100 text-bakery-700">
            <MapPin className="size-5" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-widest text-bakery-700 uppercase">
              {contentString(c, "overline")}
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold">{title}</h2>
            <p className="text-muted-foreground">{description}</p>
          </div>
          <Button
            variant="bakery"
            className="h-11"
            render={<a href={location.mapUrl} target="_blank" rel="noopener noreferrer" />}
          >
            <MapPin className="size-4" />
            {buttonLabel}
          </Button>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-cream-50 p-4">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-bakery-700">
              <Store className="size-4" />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium text-foreground">{location.address}</p>
              {location.phone ? (
                <a
                  href={`tel:${location.phone.replace(/\s+/g, "")}`}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-bakery-700"
                >
                  <Phone className="size-3" />
                  {location.phone}
                </a>
              ) : null}
            </div>
          </div>

          {/* Only the shop's own hours. The three shipped rows are dropped as a
              set upstream — printing seeded opening times is a claim about when
              a stranger can turn up at the door. */}
          {location.hours.length > 0 ? (
            <div className="rounded-xl border border-border bg-cream-50 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Clock className="size-3.5 text-bakery-700" />
                Opening hours
              </p>
              <dl className="space-y-1">
                {location.hours.map((entry) => (
                  <div key={entry.day} className="flex justify-between gap-3 text-xs">
                    <dt className="text-muted-foreground">{entry.day}</dt>
                    <dd className="font-medium text-foreground">{entry.hours}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>
      </div>
    </SectionShell>
  );
}

function CategoriesSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const maxCount = contentNumber(c, "maxCount", 6);
  const items = (props.categories ?? getHomepageCategories(maxCount)).slice(0, maxCount);

  return (
    <SectionShell {...props} noReveal>
      <ScrollReveal>
        <SectionHeader
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          description={contentString(c, "description")}
        />
      </ScrollReveal>
      <StaggerReveal className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3">
        {items.map((category) => (
          <Link
            key={category.id}
            href={routes.store.collection(category.slug)}
            className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-white transition-all duration-300 hover:border-bakery-300 hover:shadow-md"
          >
            <div className="relative aspect-[4/3] bg-muted">
              {category.image ? (
                <OptimizedImage src={category.image} alt={category.name} fill className="object-cover" sizes="300px" />
              ) : null}
            </div>
            <div className="p-4">
              <p className="font-medium">{category.name}</p>
              <p className="text-xs text-muted-foreground">{category.count} cakes</p>
            </div>
          </Link>
        ))}
      </StaggerReveal>
    </SectionShell>
  );
}

function ProductGridSection(
  props: HomepageSectionRendererProps & {
    cakes: LandingProduct[];
    showCta?: boolean;
  }
) {
  const c = props.section.content;
  const maxCount = contentNumber(c, "maxCount", 4);
  const ctaHref = contentString(c, "ctaHref");
  const ctaLabel = contentString(c, "ctaLabel");

  return (
    <SectionShell {...props} noReveal>
      <ScrollReveal>
        <SectionHeader
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          description={contentString(c, "description")}
        />
      </ScrollReveal>
      <StaggerReveal className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {props.cakes.slice(0, maxCount).map((cake) => (
          <ProductCard key={cake.id} cake={cake} className="h-full" />
        ))}
      </StaggerReveal>
      {props.showCta && ctaHref && ctaLabel ? (
        <ScrollReveal className="mt-8 text-center">
          <Button variant="outline" render={<Link href={ctaHref} />}>
            {ctaLabel}
            <ArrowRight className="size-4" />
          </Button>
        </ScrollReveal>
      ) : null}
    </SectionShell>
  );
}

const weddingPerks = [
  { icon: Palette, label: "Custom themes & colours" },
  { icon: Award, label: "Multi-tier showpieces" },
  { icon: Heart, label: "Tasting before you book" },
] as const;

function WeddingSection(props: HomepageSectionRendererProps) {
  // Wedding is bakery-only. Default to shown so SSR / bakery render unchanged,
  // then hide after mount for other business types / when the module is off.
  const [weddingEnabled, setWeddingEnabled] = useState(true);
  useEffect(() => {
    const sync = () => setWeddingEnabled(isWeddingEnabled());
    sync();
    window.addEventListener(SETTINGS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, sync);
  }, []);

  const c = props.section.content;
  const showcase = weddingCakes[0];
  /**
   * Never set, versus cleared on purpose — two different things.
   *
   * The key being absent means the section was created before it had an image
   * field, so the showcase photo stands in. The key being present and empty is
   * the "Clear image" button in the media field, and it has to mean cleared:
   * falling back there would put a stock Unsplash cake back on the live homepage
   * the moment an admin removed the demo photo, which is the opposite of what
   * they asked for.
   */
  const storedImage = c.imageUrl;
  const teaserImage =
    typeof storedImage === "string" ? storedImage.trim() : showcase?.image ?? "";

  if (!weddingEnabled) return null;

  // No background class below. This section hardcoded `surface-cream` while its
  // stored setting said "white", so the Background dropdown read White, the page
  // and the preview rendered cream, and changing the dropdown did nothing.
  return (
    <div className="contents" data-gate-wedding>
    <SectionShell {...props} noReveal>
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <ScrollReveal className="space-y-6">
          <Badge variant="accent" className="gap-1.5 rounded-full px-3.5 py-1.5 text-[13px]">
            <Heart className="size-3.5" />
            {contentString(c, "overline", "Wedding Collection")}
          </Badge>
          <div className="space-y-4">
            <h2 className="font-heading text-3xl font-bold leading-tight text-bakery-950 sm:text-4xl">
              {contentString(c, "title")}
            </h2>
            <p className="max-w-md text-base leading-relaxed text-muted-foreground">
              {contentString(c, "description")}
            </p>
          </div>
          <ul className="grid gap-3">
            {weddingPerks.map((perk) => {
              const Icon = perk.icon;
              return (
                <li key={perk.label} className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-bakery-700 shadow-sm">
                    <Icon className="size-4" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{perk.label}</span>
                </li>
              );
            })}
          </ul>
          <Button
            size="lg"
            className="rounded-xl"
            render={<Link href={contentString(c, "ctaHref", routes.store.weddingCakes)} />}
          >
            {contentString(c, "ctaLabel", "View Wedding Cakes")}
            <ArrowRight className="size-4" />
          </Button>
        </ScrollReveal>

        <ScrollReveal delay={120} className="relative mx-auto w-full max-w-lg lg:max-w-none">
          <div className="rounded-[2rem] border border-border bg-white p-2.5 shadow-md">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-cream-100 sm:aspect-[4/3] lg:aspect-square">
              {/* An empty string is a string, so `contentString`'s fallback never
                  fired for a CLEARED field — and the media field's "Clear image"
                  button sets exactly that. The result was `src=""`: next/image
                  does not throw, it just ships an empty grey panel to every
                  visitor. The wedding renderer's twin guards this the same way. */}
              {teaserImage ? (
                <OptimizedImage
                  src={teaserImage}
                  alt="Wedding cake"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 45vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                  {props.interactive ? "Choose an image for this section." : null}
                </div>
              )}
            </div>
          </div>
          {/* A floating card used to sit here naming a specific cake, quoting a
              specific price and awarding it five filled stars — all three read
              from the hardcoded `weddingCakes[0]`, not from the catalogue and not
              from any review. The price never followed the product: an admin who
              repriced that cake still had the old figure on their homepage, with
              no field anywhere in the builder to correct it. The teaser links to
              the wedding page, where the real cakes carry their real prices. */}
        </ScrollReveal>
      </div>
    </SectionShell>
    </div>
  );
}

const whyIcons = { Award, Leaf, Truck, Palette } as const;

function WhyUsSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  /**
   * The cards, from the section's own content.
   *
   * They were a hardcoded array in this function: "Over six decades of baking
   * expertise", "Finest chocolate", "Order by 2 PM for same-day delivery across
   * major cities", each asserted for whichever shop runs this CMS. The heading
   * above them was editable while the claims underneath were not.
   *
   * Empty renders no section — a heading over nothing is worse than nothing.
   */
  const items = renderableRows(parseListField(c, "items"));


  if (items.length === 0) return null;

  return (
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
        description={contentString(c, "description")}
      />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, index) => {
          const Icon = whyIcons[item.icon as keyof typeof whyIcons] ?? Award;
          return (
            <div
              key={`${item.title}-${index}`}
              className="rounded-xl border border-border bg-white p-5 transition-all duration-300 hover:border-bakery-300 hover:shadow-md"
            >
              <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-cream-100 text-bakery-700">
                <Icon className="size-5" />
              </div>
              {item.title ? (
                <p className="font-heading font-semibold">{item.title}</p>
              ) : null}
              {item.description ? (
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

function TestimonialsSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const items = props.testimonials
    ? selectStorefrontTestimonials(props.testimonials)
    : getStorefrontTestimonials();

  /**
   * Empty renders no section — the same rule every other section here follows,
   * and this was the one that did not.
   *
   * Testimonials are the section a shop is most likely to empty deliberately:
   * the ones it ships with are not its own, so drafting all of them is the
   * correct first move. Doing that painted a full-height band with a heading
   * and an empty grid under it — the shop looked like it had no customers
   * rather than like it had not written this section yet.
   */
  if (items.length === 0) return null;

  return (
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
        description={contentString(c, "description")}
      />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="flex flex-col rounded-xl border border-border bg-white p-6 transition-all duration-300 hover:border-bakery-300 hover:shadow-md"
          >
            <RatingStars rating={item.rating} className="mb-4 text-gold-300" />
            <Quote className="mb-2 size-6 text-gold-300/60" />
            <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
              {item.content}
            </p>
            <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
              <div className="relative size-10 shrink-0 overflow-hidden rounded-full">
                <OptimizedImage src={item.avatar} alt={item.name} fill className="object-cover" sizes="40px" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.role}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </SectionShell>
  );
}

function GallerySection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  /**
   * The shop's own photographs, or no grid.
   *
   * This rendered `galleryImages` — twelve stock Unsplash photos of somebody
   * else's cakes — as this shop's work, on every install, with no field to
   * change them. A customer choosing a bakery by its photographs was choosing
   * on someone else's.
   */
  const photos = limitRows(photoRows(c, "images"), contentNumber(c, "maxCount", 8));
  if (photos.length === 0) return null;
  return (
    <SectionShell {...props} noReveal>
      <ScrollReveal>
        <SectionHeader
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          description={contentString(c, "description")}
        />
      </ScrollReveal>
      <StaggerReveal className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
        {photos.map((photo, index) => {
          const src = photo.image;
          // An untouched column is "" from the editor, not undefined, so `??`
          // could never fire and the object literal was always truthy: every
          // tile shipped alt="" and an empty white pill on hover.
          const title = photo.title?.trim() ?? "";
          const tag = photo.tag?.trim() ?? "";
          return (
            <figure
              key={`${src}-${index}`}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-cream-100"
            >
              <OptimizedImage
                src={src}
                alt={title || `Gallery ${index + 1}`}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
              {title || tag ? (
                <figcaption className="absolute inset-0 flex flex-col justify-end bg-bakery-950/0 p-3 opacity-0 transition-all duration-300 group-hover:bg-bakery-950/45 group-hover:opacity-100">
                  {tag ? (
                    <span className="w-fit rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-bakery-800 uppercase">
                      {tag}
                    </span>
                  ) : null}
                  {title ? (
                    <span className="mt-1.5 font-heading text-sm font-semibold text-white">
                      {title}
                    </span>
                  ) : null}
                </figcaption>
              ) : null}
            </figure>
          );
        })}
      </StaggerReveal>
      <ScrollReveal className="mt-8 text-center">
        <Button variant="outline" render={<Link href={contentString(c, "ctaHref", routes.store.gallery)} />}>
          {contentString(c, "ctaLabel", "View Gallery")}
          <ArrowRight className="size-4" />
        </Button>
      </ScrollReveal>
    </SectionShell>
  );
}

function FaqSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const maxItems = contentNumber(c, "maxItems", 6);
  const items = props.faqs
    ? selectStorefrontFaqs(props.faqs)
    : getStorefrontFaqs();

  return (
    <SectionShell {...props} noReveal>
      <div className="mx-auto max-w-3xl">
        <ScrollReveal>
          <SectionHeader
            overline={contentString(c, "overline")}
            title={contentString(c, "title")}
            description={contentString(c, "description")}
          />
        </ScrollReveal>
        <ScrollReveal delay={100}>
          <Accordion className="mt-8 space-y-3">
            {items.slice(0, maxItems).map((faq) => (
              <AccordionItem
                key={faq.id}
                value={faq.id}
                className="overflow-hidden rounded-2xl border border-border bg-white transition-colors hover:border-bakery-300"
              >
                <AccordionTrigger className="px-5 py-4 text-left font-heading font-semibold hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-4 leading-relaxed text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollReveal>
      </div>
    </SectionShell>
  );
}

function CtaSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const card = (
    <div
      className={cn(
        "rounded-2xl border border-border bg-cream-100 px-6 py-10 text-center sm:px-10",
        props.embedded ? "flex h-full flex-col justify-center" : "mx-auto max-w-3xl"
      )}
    >
      <p className="text-xs font-semibold tracking-widest text-bakery-700 uppercase">
        {contentString(c, "overline")}
      </p>
      <h2 className="mt-3 font-heading text-3xl font-bold sm:text-4xl">{contentString(c, "title")}</h2>
      <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
        {contentString(c, "description")}
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button render={<Link href={contentString(c, "ctaHref", routes.store.contact)} />}>
          {contentString(c, "ctaLabel", "Contact Us")}
          <ArrowRight className="size-4" />
        </Button>
        {contentBoolean(c, "showPhone", true) && contentString(c, "phone") ? (
          <Button variant="outline" render={<a href={`tel:${contentString(c, "phone")}`} />}>
            <Phone className="size-4" />
            {contentString(c, "phone")}
          </Button>
        ) : null}
      </div>
    </div>
  );

  if (props.embedded) return card;
  return <SectionShell {...props}>{card}</SectionShell>;
}

function PromoBannerSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const maxCount = contentNumber(c, "maxCount", 2);
  // Prefer the server-provided banners (an SSR snapshot → identical on hydration).
  // Fall back to the client store only in the builder preview, which has no
  // server data and never server-renders.
  const banners = (props.banners ?? getActivePromoBanners(maxCount)).slice(0, maxCount);

  return (
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
        description={contentString(c, "description")}
      />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {banners.map((banner) => (
          <Link
            key={banner.id}
            href={banner.link ?? contentString(c, "ctaHref", routes.store.collections)}
            className="group relative overflow-hidden rounded-2xl border border-border"
          >
            <div className="relative aspect-[21/9] bg-muted">
              <OptimizedImage src={banner.image} alt={banner.title} fill className="object-cover" sizes="50vw" />
              <div className="absolute inset-0 bg-bakery-950/35 transition-colors group-hover:bg-bakery-950/45" />
              <div className="absolute inset-0 flex flex-col justify-end p-6 text-white">
                <p className="text-sm font-medium">{banner.title}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide">
                  {contentString(c, "ctaLabel", "Shop Now")}
                  <ArrowRight className="size-3.5" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </SectionShell>
  );
}

function OffersSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const maxCount = contentNumber(c, "maxCount", 3);
  // The shop's live coupons, read on the server. This row used to map the
  // hardcoded `specialOffers`, so it advertised BDAY20 whether or not the coupon
  // existed, was still active, or still gave 20% — and checkout refused the code
  // it had just shown the customer.
  const offers = (props.offers ?? getHomepageOffers(maxCount)).slice(0, maxCount);

  // A shop with no live coupon has no special offers. Saying so in the builder
  // is useful; saying it to a customer under a "Special Offers" heading is not,
  // so on the storefront the section simply does not appear.
  if (offers.length === 0) {
    if (!props.interactive) return null;
    return (
      <SectionShell {...props}>
        <SectionHeader
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          description={contentString(c, "description")}
        />
        <p className="mt-8 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No active coupons, so this section is hidden on the live homepage. Add
          one under Commerce → Coupons and it appears here.
        </p>
      </SectionShell>
    );
  }

  return (
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
        description={contentString(c, "description")}
      />
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {offers.map((offer) => (
          <article
            key={offer.id}
            className="overflow-hidden rounded-xl border border-border bg-white"
          >
            <div className="relative aspect-[3/2] bg-muted">
              <OptimizedImage src={offer.image} alt={offer.title || offer.discount} fill className="object-cover" sizes="33vw" />
              <Badge variant="gold" className="absolute top-3 left-3">
                {offer.discount}
              </Badge>
            </div>
            <div className="space-y-3 p-5">
              {/* Empty when the coupon's label just repeats the discount the badge
                  already shows — see sameCopy in coupon-offers.ts. */}
              {offer.title ? (
                <h3 className="font-heading text-lg font-semibold">{offer.title}</h3>
              ) : null}
              <p className="text-sm text-muted-foreground">{offer.description}</p>
              {offer.code ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-gold-300 bg-gold-50 px-3 py-2">
                  <Tag className="size-3.5 text-gold-700" />
                  <span className="font-mono text-sm font-semibold text-gold-800">{offer.code}</span>
                  {/* The condition checkout holds them to. Without it the card
                      sends a small basket to a checkout that refuses the code. */}
                  {offer.minSpend ? (
                    <span className="text-xs text-gold-800/80">{offer.minSpend}</span>
                  ) : null}
                </div>
              ) : null}
              <Button variant="bakery" className="w-full" render={<Link href={routes.store.collections} />}>
                Shop Now
              </Button>
            </div>
          </article>
        ))}
      </div>
    </SectionShell>
  );
}

function InstagramSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const maxCount = contentNumber(c, "maxCount", 6);
  /**
   * The shop's own posts, or no strip.
   *
   * This rendered six stock photos as though they were the shop's feed — under
   * a heading naming the shop's REAL handle, with every tile linking to that
   * profile. So it invited a customer to a feed that looked nothing like the
   * pictures above it. There is no Instagram API here; these are photos the
   * shop uploads, and without them the section does not appear.
   */
  const posts = limitRows(photoRows(c, "posts"), maxCount);
  if (posts.length === 0) return null;
  // The section's own content wins when the admin has set it in the builder;
  // otherwise the shop's real Instagram from Settings → Social. The shipped
  // placeholders count as "not set" — they were seeded, not chosen, and a shop
  // that has configured its own profile should not keep advertising the demo
  // account across seven links and a "Follow @…" button.
  // The LEGACY value, kept verbatim on purpose. This is not a seed — the current
  // seed sets no handle at all. Its only job is to RECOGNISE the handle stored
  // on every homepage created before that change, so the shop's real profile
  // outranks it. Renaming it to something neutral silently disabled the
  // suppression and let the old handle win again, which is the opposite of what
  // this constant is for. It goes when no install still carries the value.
  const LEGACY_SEED_HANDLE = "monginisofficial";
  const SEED_URL = "https://instagram.com";
  const contentHandle = contentString(c, "instagramHandle");
  const contentUrl = contentString(c, "instagramUrl");
  const configured = props.instagram ?? null;

  // No final fallback to a handle: with nothing stored and nothing configured
  // this stays empty, and the section below renders no "Follow @…" button
  // rather than advertising an account that does not exist.
  const handle =
    (contentHandle && contentHandle !== LEGACY_SEED_HANDLE ? contentHandle : "") ||
    configured?.handle ||
    "";

  // Seven anchors below render this. It is builder-editable content, so it is
  // admin-typed text reaching an `href` exactly like `social[].href` was —
  // `javascript:` here is script execution on the homepage. Anything that is not
  // an http(s) URL falls back rather than being rendered.
  const preferredUrl =
    (contentUrl && contentUrl !== SEED_URL ? contentUrl : "") || configured?.url || contentUrl;
  const profileUrl = isSafeSocialUrl(preferredUrl) ? preferredUrl : SEED_URL;

  return (
    <SectionShell {...props} noReveal>
      <ScrollReveal>
        <SectionHeader
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          // The legacy copy reads "@<legacy handle> — daily inspiration…", and
          // that text is stored on every homepage created before this. Swapping
          // it at RENDER time keeps the admin's own words and their stored
          // content untouched, while a shop that has set its real Instagram
          // stops advertising the old account in prose. With no handle at all
          // the mention is dropped rather than replaced with a bare "@".
          description={contentString(c, "description", handle ? `@${handle}` : "").replaceAll(
            `@${LEGACY_SEED_HANDLE}`,
            handle ? `@${handle}` : ""
          )}
        />
      </ScrollReveal>
      <StaggerReveal className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {posts.map((post, index) => (
          <a
            key={`${post.image}-${index}`}
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative block aspect-square overflow-hidden rounded-2xl border border-border bg-cream-100"
            aria-label={handle ? `View @${handle} on Instagram` : "View our Instagram"}
          >
            <OptimizedImage
              src={post.image}
              alt=""
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-bakery-950/0 transition-all duration-300 group-hover:bg-bakery-950/45">
              <Camera className="size-6 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </div>
          </a>
        ))}
      </StaggerReveal>
      {/* No handle means no account to follow. The button used to fall back to
          the seeded handle, so a shop with no Instagram invited its customers
          to follow somebody else's. */}
      {handle ? (
        <ScrollReveal className="mt-8 text-center">
          <Button variant="outline" render={<a href={profileUrl} target="_blank" rel="noopener noreferrer" />}>
            <Camera className="size-4" />
            Follow @{handle}
          </Button>
        </ScrollReveal>
      ) : null}
    </SectionShell>
  );
}

function NewsletterSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setLoading(true);

    // This form used to wait 600ms and say "Subscribed!" without writing
    // anything anywhere. Nobody was subscribed, and nobody could tell.
    const { persisted } = await addNewsletterSubscriber(email, "Homepage");
    setLoading(false);

    if (!persisted) {
      // Keep the address in the box so one tap retries it.
      toast.error("We couldn't sign you up", {
        description: "Please check your connection and try again.",
      });
      return;
    }

    toast.success("Subscribed!", {
      description: "You'll receive our sweetest updates.",
    });
    setEmail("");
  };

  const card = (
    <div
      className={cn(
        "rounded-2xl border border-border bg-cream-100 px-6 py-10 text-center sm:px-10",
        props.embedded ? "flex h-full flex-col justify-center" : "mx-auto max-w-3xl"
      )}
    >
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-white border border-border text-bakery-700">
        <Mail className="size-5" />
      </div>
      <h2 className="font-heading text-3xl font-bold sm:text-4xl">{contentString(c, "title")}</h2>
      <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
        {contentString(c, "description")}
      </p>
      <form onSubmit={handleSubmit} className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row">
        <Input
          type="email"
          aria-label="Email address"
          placeholder="Enter your email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="h-10 flex-1 bg-white"
        />
        <Button type="submit" variant="bakery" disabled={loading} className="h-10 shrink-0">
          <Send className="size-4" />
          {loading ? "Subscribing..." : contentString(c, "buttonLabel", "Subscribe")}
        </Button>
      </form>
      <p className="mt-3 text-xs text-muted-foreground">
        {contentString(c, "disclaimer", "No spam. Unsubscribe anytime.")}
      </p>
    </div>
  );

  if (props.embedded) return card;
  return <SectionShell {...props}>{card}</SectionShell>;
}

export function HomepageSectionRenderer(props: HomepageSectionRendererProps) {
  const railFor = (source: HomepageProductSource, maxCount: number) =>
    props.rails?.[source]?.slice(0, maxCount) ?? getHomepageProducts(source, maxCount);

  const { section } = props;

  switch (section.type) {
    case "hero":
      return <HeroSection {...props} />;
    case "our-menu":
      return <OurMenuSection {...props} />;
    case "store-locator":
      return <StoreLocatorSection {...props} />;
    case "promo-banner":
      return <PromoBannerSection {...props} />;
    case "categories":
      return <CategoriesSection {...props} />;
    case "featured-cakes":
      return (
        <ProductGridSection
          {...props}
          cakes={railFor("featured", contentNumber(section.content, "maxCount", 4))}
        />
      );
    case "trending":
      return (
        <ProductGridSection
          {...props}
          cakes={railFor("trending", contentNumber(section.content, "maxCount", 4))}
        />
      );
    case "best-sellers":
      return (
        <ProductGridSection
          {...props}
          cakes={railFor("best-sellers", contentNumber(section.content, "maxCount", 4))}
        />
      );
    case "offers":
      return <OffersSection {...props} />;
    case "wedding":
      return <WeddingSection {...props} />;
    case "photo-cakes":
      return (
        <ProductGridSection
          {...props}
          cakes={railFor("photo-cakes", contentNumber(section.content, "maxCount", 4))}
          showCta
        />
      );
    case "eggless":
      return (
        <ProductGridSection
          {...props}
          cakes={railFor("eggless", contentNumber(section.content, "maxCount", 4))}
          showCta
        />
      );
    case "seasonal":
      return (
        <ProductGridSection
          {...props}
          cakes={railFor("seasonal", contentNumber(section.content, "maxCount", 4))}
          showCta
        />
      );
    case "why-us":
      return <WhyUsSection {...props} />;
    case "testimonials":
      return <TestimonialsSection {...props} />;
    case "gallery":
      return <GallerySection {...props} />;
    case "instagram":
      return <InstagramSection {...props} />;
    case "faq":
      return <FaqSection {...props} />;
    case "newsletter":
      return <NewsletterSection {...props} />;
    case "cta":
      return <CtaSection {...props} />;
    default:
      return null;
  }
}
