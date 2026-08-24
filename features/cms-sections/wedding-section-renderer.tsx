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
  Tag,
  Truck,
} from "lucide-react";
import { ContactForm } from "@/components/shared/contact-form";
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
import { routes } from "@/constants/routes";
import {
  getStorefrontFaqs,
  getStorefrontTestimonials,
  selectStorefrontFaqs,
  selectStorefrontTestimonials,
} from "@/features/content/lib/storefront-content";
import {
  getWeddingCollectionProducts,
  getWeddingOffers,
} from "@/features/products/lib/wedding-catalog";
import { layoutSpacing } from "@/constants/spacing";
import type { WeddingSectionInstance } from "@/types/wedding-builder";
import type { LandingOffer, LandingProduct } from "@/constants/landing-data";
import type { FaqItem, Testimonial } from "@/types/content";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";
import { limitRows, parseListField, photoRows, renderableRows } from "@/constants/section-registry";

interface WeddingSectionRendererProps {
  section: WeddingSectionInstance;
  /** Wedding cakes + offers read on the server (absent in the builder preview). */
  weddingProducts?: LandingProduct[];
  weddingOffers?: LandingOffer[];
  testimonials?: Testimonial[];
  faqs?: FaqItem[];
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

/** The chip icons, cycled in order — the admin supplies only the words. */
const heroHighlightIcons = [Cake, Palette, Award] as const;

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

/** In the builder preview (interactive) the hero stays fully visible while
 *  editing, so it opts out of the scroll entrance; on the live page it fades up. */
function HeroStatic({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return <div className={className}>{children}</div>;
}

function WeddingHeroSection(props: WeddingSectionRendererProps) {
  const c = props.section.content;
  /**
   * The chips and the image badge, from the section's own content.
   *
   * The chips were a constant ending "60+ years of craft" and the badge read
   * "Award-winning · wedding studio" — the demo brand's age and an award nobody
   * has verified, both asserted for whichever shop runs this CMS. Empty renders
   * neither.
   */
  const highlights = renderableRows(parseListField(c, "highlights"));
  const badgeTitle = contentString(c, "badgeTitle");
  const badgeSubtitle = contentString(c, "badgeSubtitle");
  const title = contentString(c, "title", "Celebrate Your Love Story");
  // Same fade-up entrance the rest of the page uses, staggered text → image.
  const Reveal = props.interactive ? HeroStatic : ScrollReveal;
  return (
    <SectionShell {...props} className="bg-white py-12 lg:py-16">
      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <Reveal className="space-y-6 text-left">
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
          {highlights.length > 0 ? (
          <ul className="grid max-w-md gap-3 border-t border-border pt-6 sm:grid-cols-3">
            {highlights.map((item, index) => {
              const Icon = heroHighlightIcons[index % heroHighlightIcons.length];
              return (
                <li
                  key={`${item.label}-${index}`}
                  className="flex items-center gap-2.5 sm:flex-col sm:items-start sm:gap-2"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-cream-100 text-bakery-700">
                    <Icon className="size-4" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                </li>
              );
            })}
          </ul>
          ) : null}
        </Reveal>

        <Reveal delay={160} className="relative mx-auto w-full max-w-lg lg:max-w-none">
          <div className="rounded-[2rem] border border-border bg-cream-100 p-2.5 shadow-md">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-muted sm:aspect-[4/3] lg:aspect-square">
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
          {/*
            The badge said "Award-winning · wedding studio" as a constant — an
            award nobody has verified, for a studio that may not have one.
          */}
          {badgeTitle || badgeSubtitle ? (
            <div className="absolute bottom-5 left-5 flex items-center gap-2.5 rounded-2xl border border-border bg-white/95 p-3 shadow-sm">
              <span className="flex size-9 items-center justify-center rounded-xl bg-gold-100 text-gold-700">
                <Award className="size-4" />
              </span>
              <div>
                {badgeTitle ? (
                  <p className="text-sm font-bold leading-none text-foreground">{badgeTitle}</p>
                ) : null}
                {badgeSubtitle ? (
                  <p className="mt-1 text-[11px] leading-none text-muted-foreground">
                    {badgeSubtitle}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </Reveal>
      </div>
    </SectionShell>
  );
}

const whyIcons = { Award, Leaf, Truck, Palette } as const;

function WeddingWhyUsSection(props: WeddingSectionRendererProps) {
  const c = props.section.content;
  /**
   * The cards, from this section's own content.
   *
   * They came from `whyChooseUs` in landing-data — the same shared constant the
   * About template used to render — claiming six decades of expertise, Belgian
   * chocolate, and same-day delivery across 500+ cities. None of that is true
   * of every shop, and the delivery line contradicted the shop's own lead time.
   *
   * Empty renders no section: a heading over nothing is worse than nothing.
   */
  const items = renderableRows(parseListField(c, "items"));
  if (items.length === 0) return null;

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
        {items.map((item, index) => {
          const Icon = whyIcons[item.icon as keyof typeof whyIcons] ?? Award;
          return (
            <div
              key={`${item.title}-${index}`}
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
  const offers = (props.weddingOffers ?? getWeddingOffers(maxCount)).slice(0, maxCount);

  // Same rule as the homepage offers row: with no live coupon there is no offer
  // to make, so the storefront omits the section rather than heading an empty
  // grid. The builder says why, so the admin is not left guessing.
  if (offers.length === 0) {
    if (!props.interactive) return null;
    return (
      <SectionShell {...props} noReveal>
        <SectionHeader
          title={contentString(c, "title", "Wedding Offers")}
          description={contentString(c, "description")}
        />
        <p className="mt-8 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No active coupons, so this section is hidden on the live wedding page.
          Add one under Commerce → Coupons and it appears here.
        </p>
      </SectionShell>
    );
  }

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
              <Image src={offer.image} alt={offer.title || offer.discount} fill className="object-cover" sizes="300px" />
              <Badge className="absolute top-3 left-3" variant="gold">
                {offer.discount}
              </Badge>
            </div>
            <div className="p-4">
              {/* Empty when the coupon's label just repeats the discount the badge
                  already shows — see sameCopy in coupon-offers.ts. */}
              {offer.title ? (
                <h3 className="font-heading font-semibold">{offer.title}</h3>
              ) : null}
              <p className="mt-1 text-sm text-muted-foreground">{offer.description}</p>
              {/* The code was never shown here, so a customer could read a real
                  wedding discount and have no way to claim it. The homepage twin
                  has always shown it. */}
              {offer.code ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-gold-300 bg-gold-50 px-3 py-2">
                  <Tag className="size-3.5 text-gold-700" />
                  <span className="font-mono text-sm font-semibold text-gold-800">
                    {offer.code}
                  </span>
                  {offer.minSpend ? (
                    <span className="text-xs text-gold-800/80">{offer.minSpend}</span>
                  ) : null}
                </div>
              ) : null}
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
  // Prefer the server-provided snapshot (SSR → identical on hydration); fall back
  // to the client store only in the builder preview, which never server-renders.
  const cakes = (props.weddingProducts ?? getWeddingCollectionProducts(maxCount)).slice(0, maxCount);

  // No wedding cakes in the catalogue means no collection to show. The grid used
  // to fill itself from demo data rather than say so — see
  // selectWeddingCollectionProducts.
  if (cakes.length === 0) {
    if (!props.interactive) return null;
    return (
      <SectionShell {...props} noReveal>
        <h2 className="font-heading mb-2 text-2xl font-bold">
          {contentString(c, "title", "Wedding Collections")}
        </h2>
        <p className="mb-8 text-muted-foreground">{contentString(c, "description")}</p>
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No published cakes in a wedding category, so this section is hidden on
          the live page. Add one under Products and it appears here.
        </p>
      </SectionShell>
    );
  }

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
  /**
   * The shop's own photographs, or no grid.
   *
   * `getWeddingGalleryImages` returned a slice of `galleryImages` — the same
   * twelve stock Unsplash photos the homepage showed — presented as this shop's
   * wedding work. A couple choosing a bakery by its cakes was choosing on
   * somebody else's.
   */
  const photos = limitRows(photoRows(c, "images"), maxCount);
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
          // "" from the editor, never undefined — see the homepage gallery.
          const title = photo.title?.trim() ?? "";
          const tag = photo.tag?.trim() ?? "";
          return (
            <figure
              key={`${src}-${index}`}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-cream-100"
            >
              <Image
                src={src}
                alt={title || `Wedding gallery ${index + 1}`}
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

function WeddingTestimonialsSection(props: WeddingSectionRendererProps) {
  const c = props.section.content;
  const maxCount = contentNumber(c, "maxCount", 2);
  const allTestimonials = props.testimonials
    ? selectStorefrontTestimonials(props.testimonials)
    : getStorefrontTestimonials();
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

  /**
   * Empty renders no section — the rule four of this file's sections already
   * follow, and the two that did not are the two most likely to BE empty.
   *
   * Testimonials are what a shop drafts first: the ones it ships with are not
   * its own. Doing that left "What Couples Say" over an empty two-column grid on
   * the wedding page, so the shop looked like it had no couples rather than like
   * it had not written this section yet. Same defect, same fix, as the homepage's
   * `TestimonialsSection`.
   */
  if (items.length === 0) return null;

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
              <RatingStars rating={item.rating} className="text-gold-500" />
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
  const weddingCategoryFaqs = props.faqs
    ? selectStorefrontFaqs(props.faqs, "wedding")
    : getStorefrontFaqs("wedding");
  const allFaqs = props.faqs ? selectStorefrontFaqs(props.faqs) : getStorefrontFaqs();
  const keywordFaqs = allFaqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes("wedding") ||
      faq.answer.toLowerCase().includes("wedding")
  );
  const items = (
    weddingCategoryFaqs.length > 0 ? weddingCategoryFaqs : keywordFaqs.length > 0 ? keywordFaqs : allFaqs
  ).slice(0, maxItems);

  // Same rule. Three fallbacks deep, this still lands on an empty list for a
  // shop that has written no FAQs at all — and a heading with an accordion of
  // nothing under it reads as broken rather than as unfinished.
  if (items.length === 0) return null;

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
