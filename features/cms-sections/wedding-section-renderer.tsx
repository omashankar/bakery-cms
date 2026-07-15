"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  Cake,
  Heart,
  Leaf,
  Palette,
  Quote,
  Star,
  Truck,
} from "lucide-react";
import { ContactForm } from "@/features/storefront/components/contact-form";
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
import { routes } from "@/constants/routes";
import { galleryCaptions, whyChooseUs } from "@/constants/landing-data";
import { getStorefrontFaqs, getStorefrontTestimonials } from "@/features/storefront/lib/content";
import {
  getWeddingCollectionCakes,
  getWeddingGalleryImages,
  getWeddingOffers,
} from "@/features/storefront/lib/wedding-catalog";
import { layoutSpacing } from "@/constants/spacing";
import type { WeddingSectionInstance } from "@/types/wedding-builder";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";

interface WeddingSectionRendererProps {
  section: WeddingSectionInstance;
  selected?: boolean;
  onSelect?: () => void;
  interactive?: boolean;
}

function contentString(
  content: WeddingSectionInstance["content"],
  key: string,
  fallback = ""
): string {
  const value = content[key];
  return typeof value === "string" ? value : fallback;
}

function contentNumber(
  content: WeddingSectionInstance["content"],
  key: string,
  fallback: number
): number {
  const value = content[key];
  return typeof value === "number" ? value : Number(value) || fallback;
}

function contentBoolean(
  content: WeddingSectionInstance["content"],
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
  id,
  noReveal,
}: WeddingSectionRendererProps & {
  children: React.ReactNode;
  className?: string;
  id?: string;
  noReveal?: boolean;
}) {
  const bgClass = section.background === "cream" ? "surface-cream" : "bg-white";
  // Grid sections opt out (noReveal) and animate their own cards via StaggerReveal;
  // the hero has its own entrance. Everything else fades up as one block on scroll.
  const revealOnScroll = !interactive && section.type !== "wedding-hero" && !noReveal;

  return (
    <section
      id={id}
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

const heroHighlights = [
  { icon: Cake, label: "Bespoke tiered designs" },
  { icon: Palette, label: "Themed to your colours" },
  { icon: Award, label: "60+ years of craft" },
] as const;

function accentLastWord(text: string) {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return text;
  return (
    <>
      {words.slice(0, -1).join(" ")}{" "}
      <span className="text-bakery-600">{words[words.length - 1]}</span>
    </>
  );
}

function WeddingHeroSection(props: WeddingSectionRendererProps) {
  const c = props.section.content;
  const title = contentString(c, "title", "Celebrate Your Love Story");
  return (
    <SectionShell {...props} className="border-b border-border bg-white py-12 lg:py-16">
      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div className="space-y-6 text-left">
          {contentString(c, "overline") ? (
            <Badge variant="accent" className="gap-1.5 rounded-full px-3.5 py-1.5 text-[13px]">
              <Heart className="size-3.5" />
              {contentString(c, "overline")}
            </Badge>
          ) : null}
          <div className="space-y-4">
            <h1 className="font-heading text-[2.25rem] font-bold leading-[1.1] tracking-tight text-bakery-950 sm:text-[2.75rem] lg:text-5xl">
              {accentLastWord(title)}
            </h1>
            <p className="max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
              {contentString(c, "description")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" className="rounded-xl" render={<a href={contentString(c, "ctaHref", "#inquiry")} />}>
              {contentString(c, "ctaLabel", "Request a Quote")}
              <ArrowRight className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-xl"
              render={<Link href={routes.store.gallery} />}
            >
              View Gallery
            </Button>
          </div>
          <ul className="grid max-w-md gap-3 border-t border-border pt-6 sm:grid-cols-3">
            {heroHighlights.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label} className="flex items-center gap-2.5 sm:flex-col sm:items-start sm:gap-2">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-cream-100 text-bakery-700">
                    <Icon className="size-4" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
          <div className="rounded-[2rem] border border-border bg-cream-100 p-2.5 shadow-md">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-muted sm:aspect-[4/3] lg:aspect-[4/5]">
              {contentString(c, "imageUrl") ? (
                <Image
                  src={contentString(c, "imageUrl")}
                  alt={contentString(c, "title", "Wedding cake")}
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 45vw"
                />
              ) : null}
            </div>
          </div>
          <div className="absolute bottom-5 left-5 flex items-center gap-2.5 rounded-2xl border border-border bg-white/95 p-3 shadow-sm">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gold-100 text-gold-700">
              <Award className="size-4" />
            </span>
            <div>
              <p className="text-sm font-bold leading-none text-foreground">Award-winning</p>
              <p className="mt-1 text-[11px] leading-none text-muted-foreground">wedding studio</p>
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

const whyIcons = { Award, Leaf, Truck, Palette } as const;

function WeddingWhyUsSection(props: WeddingSectionRendererProps) {
  const c = props.section.content;
  return (
    <SectionShell {...props} noReveal>
      <ScrollReveal>
        <h2 className="font-heading mb-2 text-2xl font-bold sm:text-3xl">
          {contentString(c, "title", "Why Choose Us")}
        </h2>
        <p className="mb-8 max-w-2xl text-muted-foreground">
          {contentString(c, "description")}
        </p>
      </ScrollReveal>
      <StaggerReveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {whyChooseUs.map((item) => {
          const Icon = whyIcons[item.icon as keyof typeof whyIcons] ?? Award;
          return (
            <div
              key={item.title}
              className="h-full rounded-xl border border-border bg-white p-5 transition-all hover:border-bakery-300 hover:shadow-sm"
            >
              <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-cream-100 text-bakery-700">
                <Icon className="size-5" />
              </div>
              <h3 className="font-heading font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
            </div>
          );
        })}
      </StaggerReveal>
    </SectionShell>
  );
}

function WeddingOffersSection(props: WeddingSectionRendererProps) {
  const c = props.section.content;
  const maxCount = contentNumber(c, "maxCount", 3);
  const offers = getWeddingOffers(maxCount);

  return (
    <SectionShell {...props} noReveal>
      <ScrollReveal>
        <SectionHeader
          title={contentString(c, "title", "Wedding Offers")}
          description={contentString(c, "description")}
        />
      </ScrollReveal>
      <StaggerReveal className="mt-8 grid gap-4 md:grid-cols-3">
        {offers.map((offer) => (
          <article key={offer.id} className="h-full overflow-hidden rounded-xl border border-border bg-white">
            <div className="relative aspect-[16/10] bg-muted">
              <Image src={offer.image} alt={offer.title} fill className="object-cover" sizes="300px" />
              <Badge className="absolute top-3 left-3" variant="gold">
                {offer.discount}
              </Badge>
            </div>
            <div className="p-4">
              <h3 className="font-heading font-semibold">{offer.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{offer.description}</p>
            </div>
          </article>
        ))}
      </StaggerReveal>
    </SectionShell>
  );
}

function WeddingCollectionsSection(props: WeddingSectionRendererProps) {
  const c = props.section.content;
  const maxCount = contentNumber(c, "maxCount", 6);
  const cakes = getWeddingCollectionCakes(maxCount);

  return (
    <SectionShell {...props} noReveal>
      <ScrollReveal>
        <h2 className="font-heading mb-2 text-2xl font-bold">
          {contentString(c, "title", "Wedding Collections")}
        </h2>
        <p className="mb-8 text-muted-foreground">{contentString(c, "description")}</p>
      </ScrollReveal>
      <StaggerReveal className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cakes.map((cake) => (
          <Link
            key={cake.id}
            href={routes.store.cake(cake.slug)}
            className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white transition-all hover:border-bakery-300 hover:shadow-md"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-cream-100">
              <Image
                src={cake.image}
                alt={cake.name}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="33vw"
              />
            </div>
            <div className="flex flex-1 flex-col p-5">
              <h3 className="font-heading font-semibold">{cake.name}</h3>
              <p className="mt-1.5 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {cake.description}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <div>
                  <p className="text-[11px] text-muted-foreground">Starting from</p>
                  <p className="font-heading text-lg font-bold text-bakery-700">
                    {formatCurrency(cake.price)}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-sm font-medium text-bakery-700 transition-transform group-hover:translate-x-0.5">
                  View <ArrowRight className="size-4" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </StaggerReveal>
    </SectionShell>
  );
}

function WeddingGallerySection(props: WeddingSectionRendererProps) {
  const c = props.section.content;
  const maxCount = contentNumber(c, "maxCount", 8);
  const images = getWeddingGalleryImages(maxCount);

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
        {images.map((src, index) => {
          const caption = galleryCaptions[index];
          return (
            <figure
              key={src}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-cream-100"
            >
              <Image
                src={src}
                alt={caption?.title ?? `Wedding gallery ${index + 1}`}
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

function WeddingTestimonialsSection(props: WeddingSectionRendererProps) {
  const c = props.section.content;
  const maxCount = contentNumber(c, "maxCount", 2);
  const allTestimonials = getStorefrontTestimonials();
  const weddingTestimonials = allTestimonials.filter((item) =>
    item.role.toLowerCase().includes("wedding")
  );
  // Wedding-specific first, then top up from all reviews so the row never shows a
  // single lonely card in a two-column grid.
  const seen = new Set(weddingTestimonials.map((item) => item.id));
  const items = [
    ...weddingTestimonials,
    ...allTestimonials.filter((item) => !seen.has(item.id)),
  ];

  return (
    <SectionShell {...props} noReveal>
      <ScrollReveal>
        <SectionHeader
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          description={contentString(c, "description")}
        />
      </ScrollReveal>
      <StaggerReveal className="mt-8 grid gap-5 md:grid-cols-2">
        {items.slice(0, maxCount).map((item) => (
          <article
            key={item.id}
            className="flex h-full flex-col rounded-2xl border border-border bg-white p-6 transition-all hover:border-bakery-300 hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex gap-0.5 text-gold-500">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-4 fill-current" />
                ))}
              </div>
              <Quote className="size-7 text-gold-300/60" />
            </div>
            <p className="mt-4 flex-1 leading-relaxed text-muted-foreground">{item.content}</p>
            <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
              <div className="relative size-11 overflow-hidden rounded-full">
                <Image src={item.avatar} alt={item.name} fill className="object-cover" sizes="44px" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.role}</p>
              </div>
            </div>
          </article>
        ))}
      </StaggerReveal>
    </SectionShell>
  );
}

function WeddingInquirySection(props: WeddingSectionRendererProps) {
  const c = props.section.content;
  return (
    <SectionShell {...props} id="inquiry">
      <div className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-heading text-2xl font-bold sm:text-3xl">
            {contentString(c, "title", "Wedding Inquiry")}
          </h2>
          <p className="mt-2 text-muted-foreground">{contentString(c, "description")}</p>
          {contentString(c, "note") ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Heart className="size-4 text-bakery-700" />
              {contentString(c, "note")}
            </div>
          ) : null}
        </div>
        <div className="rounded-xl border border-border bg-white p-6">
          <ContactForm
            inquiryType="wedding"
            defaultSubject={contentString(c, "defaultSubject", "Wedding cake inquiry")}
            submitLabel={contentString(c, "submitLabel", "Submit Wedding Inquiry")}
          />
        </div>
      </div>
    </SectionShell>
  );
}

function WeddingFaqSection(props: WeddingSectionRendererProps) {
  const c = props.section.content;
  const maxItems = contentNumber(c, "maxItems", 5);
  const weddingCategoryFaqs = getStorefrontFaqs("wedding");
  const allFaqs = getStorefrontFaqs();
  const keywordFaqs = allFaqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes("wedding") ||
      faq.answer.toLowerCase().includes("wedding")
  );
  const items = (
    weddingCategoryFaqs.length > 0 ? weddingCategoryFaqs : keywordFaqs.length > 0 ? keywordFaqs : allFaqs
  ).slice(0, maxItems);

  return (
    <SectionShell {...props}>
      <div className="mx-auto max-w-3xl">
        <SectionHeader
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          description={contentString(c, "description")}
        />
        <Accordion className="mt-8 space-y-3">
          {items.map((faq) => (
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
      </div>
    </SectionShell>
  );
}

function WeddingCtaSection(props: WeddingSectionRendererProps) {
  const c = props.section.content;
  return (
    <SectionShell {...props}>
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-cream-100 px-6 py-10 text-center sm:px-10">
        <Cake className="mx-auto mb-3 size-8 text-bakery-700" />
        <h2 className="font-heading text-3xl font-bold">{contentString(c, "title")}</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          {contentString(c, "description")}
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button render={<Link href={contentString(c, "ctaHref", routes.store.contact)} />}>
            {contentString(c, "ctaLabel", "Contact Us")}
            <ArrowRight className="size-4" />
          </Button>
          {contentBoolean(c, "showGalleryLink", true) ? (
            <Button variant="outline" render={<Link href={routes.store.gallery} />}>
              View Gallery
            </Button>
          ) : null}
        </div>
      </div>
    </SectionShell>
  );
}

export function WeddingSectionRenderer(props: WeddingSectionRendererProps) {
  switch (props.section.type) {
    case "wedding-hero":
      return <WeddingHeroSection {...props} />;
    case "wedding-why-us":
      return <WeddingWhyUsSection {...props} />;
    case "wedding-offers":
      return <WeddingOffersSection {...props} />;
    case "wedding-collections":
      return <WeddingCollectionsSection {...props} />;
    case "wedding-gallery":
      return <WeddingGallerySection {...props} />;
    case "wedding-testimonials":
      return <WeddingTestimonialsSection {...props} />;
    case "wedding-inquiry":
      return <WeddingInquirySection {...props} />;
    case "wedding-faq":
      return <WeddingFaqSection {...props} />;
    case "wedding-cta":
      return <WeddingCtaSection {...props} />;
    default:
      return null;
  }
}
