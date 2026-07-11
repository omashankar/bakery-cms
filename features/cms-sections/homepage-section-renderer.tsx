"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  Camera,
  Heart,
  Images,
  Leaf,
  Mail,
  Phone,
  Quote,
  Send,
  Star,
  Tag,
  Truck,
  Palette,
} from "lucide-react";
import { CakeProductCard } from "@/features/landing/components/cake-product-card";
import { SectionHeader } from "@/components/shared/section-header";
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
  galleryImages,
  instagramPosts,
  specialOffers,
  weddingCakes,
  type LandingCake,
} from "@/constants/landing-data";
import { routes } from "@/constants/routes";
import { getActivePromoBanners } from "@/features/admin/banners/lib/banners-repository";
import { getStorefrontFaqs, getStorefrontTestimonials } from "@/features/storefront/lib/content";
import {
  getHomepageCakes,
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
  selected?: boolean;
  onSelect?: () => void;
  interactive?: boolean;
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
}: HomepageSectionRendererProps & { children: React.ReactNode; className?: string }) {
  const bgClass = section.background === "cream" ? "surface-cream" : "bg-white";

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
      <div className={layoutSpacing.container}>{children}</div>
    </section>
  );
}

function HeroSection(props: HomepageSectionRendererProps) {
  const { section } = props;
  const c = section.content;

  return (
    <SectionShell {...props} className="bg-white">
      <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="space-y-6">
          <Badge variant="accent" className="px-3 py-1">
            {contentString(c, "badge")}
          </Badge>
          <div className="space-y-3">
            <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              {contentString(c, "headline")}
            </h2>
            <p className="text-muted-foreground">{contentString(c, "subtext")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button render={<Link href={contentString(c, "ctaPrimaryHref", routes.store.collections)} />}>
              {contentString(c, "ctaPrimaryLabel", "Shop Cakes")}
              <ArrowRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              render={<Link href={contentString(c, "ctaSecondaryHref", routes.store.weddingCakes)} />}
            >
              {contentString(c, "ctaSecondaryLabel", "Wedding Collection")}
            </Button>
          </div>
        </div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-border bg-muted">
          {contentString(c, "imageUrl") ? (
            <Image
              src={contentString(c, "imageUrl")}
              alt={contentString(c, "headline", "Hero")}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          ) : null}
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
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
        description={contentString(c, "description")}
      />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((category) => (
          <Link
            key={category.id}
            href={routes.store.collection(category.slug)}
            className="group overflow-hidden rounded-xl border border-border bg-white"
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
      </div>
    </SectionShell>
  );
}

function CakeGridSection(
  props: HomepageSectionRendererProps & {
    cakes: LandingCake[];
    showCta?: boolean;
  }
) {
  const c = props.section.content;
  const maxCount = contentNumber(c, "maxCount", 4);
  const ctaHref = contentString(c, "ctaHref");
  const ctaLabel = contentString(c, "ctaLabel");

  return (
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
        description={contentString(c, "description")}
      />
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {props.cakes.slice(0, maxCount).map((cake) => (
          <CakeProductCard key={cake.id} cake={cake} />
        ))}
      </div>
      {props.showCta && ctaHref && ctaLabel ? (
        <div className="mt-8 text-center">
          <Button variant="outline" render={<Link href={ctaHref} />}>
            {ctaLabel}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      ) : null}
    </SectionShell>
  );
}

function WeddingSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const showcase = weddingCakes[0];

  return (
    <SectionShell {...props}>
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <p className="text-xs font-semibold tracking-widest text-bakery-700 uppercase">
            {contentString(c, "overline")}
          </p>
          <h2 className="font-heading text-3xl font-bold">{contentString(c, "title")}</h2>
          <p className="text-muted-foreground">{contentString(c, "description")}</p>
          <Button render={<Link href={contentString(c, "ctaHref", routes.store.weddingCakes)} />}>
            <Heart className="size-4" />
            {contentString(c, "ctaLabel", "View Wedding Cakes")}
          </Button>
        </div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-border">
          <Image
            src={contentString(c, "imageUrl", showcase?.image ?? "")}
            alt="Wedding cake"
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          {showcase ? (
            <div className="absolute right-4 bottom-4 rounded-xl border border-border bg-white/95 p-4 shadow-sm">
              <p className="text-sm font-medium">{showcase.name}</p>
              <p className="text-sm text-bakery-700">{formatCurrency(showcase.price)}</p>
            </div>
          ) : null}
        </div>
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
            <div key={item.title} className="rounded-xl border border-border bg-white p-5">
              <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-cream-100 text-bakery-700">
                <Icon className="size-4" />
              </div>
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
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
          <article key={item.id} className="rounded-xl border border-border bg-white p-5">
            <Quote className="mb-3 size-6 text-gold-300" />
            <p className="text-sm text-muted-foreground">{item.content}</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="relative size-10 overflow-hidden rounded-full">
                <Image src={item.avatar} alt={item.name} fill className="object-cover" sizes="40px" />
              </div>
              <div>
                <p className="text-sm font-medium">{item.name}</p>
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
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
        description={contentString(c, "description")}
      />
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {galleryImages.slice(0, 8).map((src, index) => (
          <div
            key={src}
            className={cn(
              "relative overflow-hidden rounded-xl border border-border bg-muted",
              index % 3 === 0 ? "aspect-[4/5]" : "aspect-square"
            )}
          >
            <Image src={src} alt={`Gallery ${index + 1}`} fill className="object-cover" sizes="200px" />
          </div>
        ))}
      </div>
      <div className="mt-6 text-center">
        <Button variant="outline" render={<Link href={contentString(c, "ctaHref", routes.store.gallery)} />}>
          {contentString(c, "ctaLabel", "View Gallery")}
        </Button>
      </div>
    </SectionShell>
  );
}

function FaqSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const maxItems = contentNumber(c, "maxItems", 6);
  const items = getStorefrontFaqs();

  return (
    <SectionShell {...props}>
      <div className="mx-auto max-w-3xl">
        <SectionHeader
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          description={contentString(c, "description")}
        />
        <Accordion className="mt-8">
          {items.slice(0, maxItems).map((faq) => (
            <AccordionItem key={faq.id} value={faq.id}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </SectionShell>
  );
}

function CtaSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  return (
    <SectionShell {...props}>
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-cream-100 px-6 py-10 text-center sm:px-10">
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
    </SectionShell>
  );
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
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
        description={contentString(c, "description", `@${handle}`)}
      />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {instagramPosts.slice(0, maxCount).map((post) => (
          <a
            key={post.id}
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted"
            aria-label="View on Instagram"
          >
            <Image src={post.image} alt="Instagram post" fill className="object-cover" sizes="16vw" />
            <div className="absolute inset-0 flex items-center justify-center bg-bakery-950/0 transition-colors group-hover:bg-bakery-950/40">
              <Star className="size-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </a>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Button variant="outline" render={<a href={profileUrl} target="_blank" rel="noopener noreferrer" />}>
          <Camera className="size-4" />
          Follow @{handle}
        </Button>
      </div>
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

  return (
    <SectionShell {...props}>
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-cream-100 px-6 py-10 text-center sm:px-10">
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
    </SectionShell>
  );
}

export function HomepageSectionRenderer(props: HomepageSectionRendererProps) {
  const { section } = props;

  switch (section.type) {
    case "hero":
      return <HeroSection {...props} />;
    case "promo-banner":
      return <PromoBannerSection {...props} />;
    case "categories":
      return <CategoriesSection {...props} />;
    case "featured-cakes":
      return (
        <CakeGridSection
          {...props}
          cakes={getHomepageCakes("featured", contentNumber(section.content, "maxCount", 4))}
        />
      );
    case "trending":
      return (
        <CakeGridSection
          {...props}
          cakes={getHomepageCakes("trending", contentNumber(section.content, "maxCount", 4))}
        />
      );
    case "best-sellers":
      return (
        <CakeGridSection
          {...props}
          cakes={getHomepageCakes("best-sellers", contentNumber(section.content, "maxCount", 4))}
        />
      );
    case "offers":
      return <OffersSection {...props} />;
    case "wedding":
      return <WeddingSection {...props} />;
    case "photo-cakes":
      return (
        <CakeGridSection
          {...props}
          cakes={getHomepageCakes("photo-cakes", contentNumber(section.content, "maxCount", 4))}
          showCta
        />
      );
    case "eggless":
      return (
        <CakeGridSection
          {...props}
          cakes={getHomepageCakes("eggless", contentNumber(section.content, "maxCount", 4))}
          showCta
        />
      );
    case "seasonal":
      return (
        <CakeGridSection
          {...props}
          cakes={getHomepageCakes("seasonal", contentNumber(section.content, "maxCount", 4))}
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
