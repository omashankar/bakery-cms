"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Camera,
  Clock,
  Heart,
  Images,
  Leaf,
  Mail,
  MapPin,
  Phone,
  Quote,
  Search,
  Send,
  Star,
  Store,
  Tag,
  Truck,
  Palette,
} from "lucide-react";
import { CakeProductCard } from "@/features/landing/components/cake-product-card";
import { SectionHeader } from "@/components/shared/section-header";
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
  galleryCaptions,
  galleryImages,
  instagramPosts,
  specialOffers,
  weddingCakes,
  type LandingProduct,
} from "@/constants/landing-data";
import { routes } from "@/constants/routes";
import {
  getActiveHeroBanners,
  getActivePromoBanners,
} from "@/features/content/lib/banners-repository";
import { HeroCarousel, type HeroSlide } from "./hero-carousel";
import { getStorefrontFaqs, getStorefrontTestimonials } from "@/features/storefront/lib/content";
import {
  getHomepageProducts,
  type HomepageProductSource,
  getHomepageCategories,
} from "@/features/storefront/lib/homepage-catalog";
import { layoutSpacing } from "@/constants/spacing";
import type { HomepageSectionInstance } from "@/types/homepage-builder";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";
import { useState } from "react";
import { toast } from "sonner";

interface HomepageSectionRendererProps {
  section: HomepageSectionInstance;
  /**
   * Product rails built on the server. When absent (admin builder preview) the
   * renderer falls back to the browser catalogue.
   */
  rails?: Partial<Record<HomepageProductSource, LandingProduct[]>>;
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

const heroTrustBar = [
  { icon: "Truck", title: "Free Delivery", subtitle: "On orders over ₹999" },
  { icon: "Clock", title: "Same-Day Delivery", subtitle: "Order today, get today" },
  { icon: "BadgeCheck", title: "100% Quality", subtitle: "Premium ingredients" },
  { icon: "Heart", title: "Made with Love", subtitle: "Since 1956" },
] as const;

const heroTrustIcons = { Truck, Clock, BadgeCheck, Heart } as const;

function HeroSection(props: HomepageSectionRendererProps) {
  const { section } = props;
  const c = section.content;

  const cmsSlide: HeroSlide = {
    badge: contentString(c, "badge"),
    headline: contentString(c, "headline"),
    subtext: contentString(c, "subtext"),
    primaryLabel: contentString(c, "ctaPrimaryLabel", "Shop Cakes"),
    primaryHref: contentString(c, "ctaPrimaryHref", routes.store.collections),
    secondaryLabel: contentString(c, "ctaSecondaryLabel", "Wedding Collection"),
    secondaryHref: contentString(c, "ctaSecondaryHref", routes.store.weddingCakes),
    imageUrl: contentString(c, "imageUrl"),
  };

  const bannerSlides: HeroSlide[] = getActiveHeroBanners("homepage")
    .slice(0, 3)
    .map((banner) => ({
      badge: "Featured",
      headline: banner.title,
      subtext: "Freshly baked and delivered to your door — order today.",
      primaryLabel: "Shop Now",
      primaryHref: banner.link ?? routes.store.collections,
      imageUrl: banner.image,
    }));

  const slides = [cmsSlide, ...bannerSlides].filter(
    (slide) => slide.headline || slide.imageUrl
  );

  return (
    <SectionShell {...props} className="bg-white py-10 sm:py-12 lg:py-16">
      <HeroCarousel slides={slides} />

      <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-5 rounded-2xl border border-border bg-cream-50 p-5 sm:mt-12 sm:gap-6 sm:p-6 lg:grid-cols-4">
        {heroTrustBar.map((item) => {
          const Icon = heroTrustIcons[item.icon as keyof typeof heroTrustIcons];
          return (
            <div key={item.title} className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-white text-bakery-700 shadow-sm">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.subtitle}</p>
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
  const items = getHomepageCategories(contentNumber(c, "maxCount", 8));

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
                <Image
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

function StoreLocatorForm({ buttonLabel }: { buttonLabel: string }) {
  const [pincode, setPincode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pincode.trim()) return;
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    toast.success("Stores found", {
      description: `Showing outlets near ${pincode}.`,
    });
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
      <Input
        value={pincode}
        onChange={(event) => setPincode(event.target.value)}
        inputMode="numeric"
        placeholder="Enter your pincode"
        aria-label="Pincode"
        className="h-11 flex-1 bg-white"
      />
      <Button type="submit" variant="bakery" disabled={loading} className="h-11 shrink-0">
        <Search className="size-4" />
        {loading ? "Searching…" : buttonLabel}
      </Button>
    </form>
  );
}

const locatorStores = [
  { name: "Monginis — Andheri West", address: "Shop 4, Link Road, Mumbai", distance: "1.2 km" },
  { name: "Monginis — Bandra", address: "Hill Road, Bandra West, Mumbai", distance: "3.5 km" },
  { name: "Monginis — Powai", address: "Central Avenue, Powai, Mumbai", distance: "6.8 km" },
];

function StoreLocatorSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;

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
            <h2 className="font-heading text-3xl font-bold">{contentString(c, "title")}</h2>
            <p className="text-muted-foreground">{contentString(c, "description")}</p>
          </div>
          <StoreLocatorForm buttonLabel={contentString(c, "buttonLabel", "Find Stores")} />
        </div>

        <div className="space-y-3">
          {locatorStores.map((store) => (
            <div
              key={store.name}
              className="flex items-start gap-3 rounded-xl border border-border bg-cream-50 p-4"
            >
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-bakery-700">
                <Store className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{store.name}</p>
                <p className="text-xs text-muted-foreground">{store.address}</p>
              </div>
              <span className="shrink-0 text-xs font-medium text-bakery-700">
                {store.distance}
              </span>
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

function CategoriesSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const maxCount = contentNumber(c, "maxCount", 6);
  const items = getHomepageCategories(maxCount);

  return (
    <SectionShell {...props} noReveal>
      <ScrollReveal>
        <SectionHeader
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          description={contentString(c, "description")}
        />
      </ScrollReveal>
      <StaggerReveal className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {items.map((category) => (
          <Link
            key={category.id}
            href={routes.store.collection(category.slug)}
            className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-white transition-premium hover:border-bakery-300 hover:shadow-sm"
          >
            <div className="relative aspect-[4/3] bg-muted">
              {category.image ? (
                <Image src={category.image} alt={category.name} fill className="object-cover" sizes="300px" />
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
          <CakeProductCard key={cake.id} cake={cake} className="h-full" />
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
  const c = props.section.content;
  const showcase = weddingCakes[0];

  return (
    <SectionShell {...props} noReveal className="surface-cream">
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
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-cream-100 sm:aspect-[4/3] lg:aspect-[4/5]">
              <Image
                src={contentString(c, "imageUrl", showcase?.image ?? "")}
                alt="Wedding cake"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 45vw"
              />
            </div>
          </div>
          {showcase ? (
            <div className="absolute right-5 bottom-5 rounded-2xl border border-border bg-white/95 p-4 shadow-sm">
              <div className="mb-1 flex gap-0.5 text-gold-500">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-3 fill-current" />
                ))}
              </div>
              <p className="text-sm font-semibold text-foreground">{showcase.name}</p>
              <p className="text-sm font-bold text-bakery-700">{formatCurrency(showcase.price)}</p>
            </div>
          ) : null}
        </ScrollReveal>
      </div>
    </SectionShell>
  );
}

const whyIcons = { Award, Leaf, Truck, Palette } as const;

function WhyUsSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const items = [
    {
      icon: "Award",
      title: "Legacy of Excellence",
      description: "Over six decades of baking expertise trusted by generations.",
    },
    {
      icon: "Leaf",
      title: "Premium Ingredients",
      description: "Finest chocolate, fresh cream, and seasonal fruits in every creation.",
    },
    {
      icon: "Truck",
      title: "Same-Day Delivery",
      description: "Order by 2 PM for same-day delivery across major cities.",
    },
    {
      icon: "Palette",
      title: "Custom Designs",
      description: "Personalized cakes crafted to your vision for every celebration.",
    },
  ];

  return (
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
        description={contentString(c, "description")}
      />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => {
          const Icon = whyIcons[item.icon as keyof typeof whyIcons] ?? Award;
          return (
            <div
              key={item.title}
              className="rounded-xl border border-border bg-white p-5 transition-premium hover:border-bakery-300 hover:shadow-sm"
            >
              <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-cream-100 text-bakery-700">
                <Icon className="size-5" />
              </div>
              <p className="font-heading font-semibold">{item.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

function TestimonialsSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const items = getStorefrontTestimonials();
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
            className="flex flex-col rounded-xl border border-border bg-white p-6 transition-premium hover:border-bakery-300 hover:shadow-sm"
          >
            <div className="mb-4 flex items-center gap-0.5 text-gold-300">
              {Array.from({ length: 5 }).map((_, star) => (
                <Star key={star} className="size-4 fill-current" />
              ))}
            </div>
            <Quote className="mb-2 size-6 text-gold-300/60" />
            <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
              {item.content}
            </p>
            <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
              <div className="relative size-10 shrink-0 overflow-hidden rounded-full">
                <Image src={item.avatar} alt={item.name} fill className="object-cover" sizes="40px" />
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
        {galleryImages.slice(0, 8).map((src, index) => {
          const caption = galleryCaptions[index];
          return (
            <figure
              key={src}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-cream-100"
            >
              <Image
                src={src}
                alt={caption?.title ?? `Gallery ${index + 1}`}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
              {caption ? (
                <figcaption className="absolute inset-0 flex flex-col justify-end bg-bakery-950/0 p-3 opacity-0 transition-all duration-300 group-hover:bg-bakery-950/45 group-hover:opacity-100">
                  <span className="w-fit rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-bakery-800 uppercase">
                    {caption.tag}
                  </span>
                  <span className="mt-1.5 font-heading text-sm font-semibold text-white">
                    {caption.title}
                  </span>
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
  const items = getStorefrontFaqs();

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
      <h2 className="mt-3 font-heading text-3xl font-bold">{contentString(c, "title")}</h2>
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
  const banners = getActivePromoBanners(maxCount);

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
              <Image src={banner.image} alt={banner.title} fill className="object-cover" sizes="50vw" />
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

  return (
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
        description={contentString(c, "description")}
      />
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {specialOffers.slice(0, maxCount).map((offer) => (
          <article
            key={offer.id}
            className="overflow-hidden rounded-xl border border-border bg-white"
          >
            <div className="relative aspect-[3/2] bg-muted">
              <Image src={offer.image} alt={offer.title} fill className="object-cover" sizes="33vw" />
              <Badge variant="gold" className="absolute top-3 left-3">
                {offer.discount}
              </Badge>
            </div>
            <div className="space-y-3 p-5">
              <h3 className="font-heading text-lg font-semibold">{offer.title}</h3>
              <p className="text-sm text-muted-foreground">{offer.description}</p>
              {offer.code ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-gold-300 bg-gold-50 px-3 py-2">
                  <Tag className="size-3.5 text-gold-700" />
                  <span className="font-mono text-sm font-semibold text-gold-800">{offer.code}</span>
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
  const handle = contentString(c, "instagramHandle", "monginisofficial");
  const profileUrl = contentString(c, "instagramUrl", "https://instagram.com");

  return (
    <SectionShell {...props} noReveal>
      <ScrollReveal>
        <SectionHeader
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          description={contentString(c, "description", `@${handle}`)}
        />
      </ScrollReveal>
      <StaggerReveal className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {instagramPosts.slice(0, maxCount).map((post) => (
          <a
            key={post.id}
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative block aspect-square overflow-hidden rounded-2xl border border-border bg-cream-100"
            aria-label={`View @${handle} on Instagram`}
          >
            <Image
              src={post.image}
              alt="Instagram post"
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
      <ScrollReveal className="mt-8 text-center">
        <Button variant="outline" render={<a href={profileUrl} target="_blank" rel="noopener noreferrer" />}>
          <Camera className="size-4" />
          Follow @{handle}
        </Button>
      </ScrollReveal>
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
    await new Promise((resolve) => setTimeout(resolve, 600));
    toast.success("Subscribed!", {
      description: "You'll receive our sweetest updates.",
    });
    setEmail("");
    setLoading(false);
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
      <h2 className="font-heading text-3xl font-bold">{contentString(c, "title")}</h2>
      <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
        {contentString(c, "description")}
      </p>
      <form onSubmit={handleSubmit} className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row">
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="h-10 flex-1 bg-white"
        />
        <Button type="submit" variant="bakery" disabled={loading} className="shrink-0">
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
