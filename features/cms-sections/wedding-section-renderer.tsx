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
  Truck,
} from "lucide-react";
import { ContactForm } from "@/features/storefront/components/contact-form";
import { SectionHeader } from "@/components/shared/section-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { whyChooseUs } from "@/constants/landing-data";
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
}: WeddingSectionRendererProps & {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const bgClass = section.background === "cream" ? "surface-cream" : "bg-white";

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
      <div className={layoutSpacing.container}>{children}</div>
    </section>
  );
}

function WeddingHeroSection(props: WeddingSectionRendererProps) {
  const c = props.section.content;
  return (
    <SectionShell {...props} className="border-b border-border bg-white py-12 lg:py-16">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-border bg-muted">
          {contentString(c, "imageUrl") ? (
            <Image
              src={contentString(c, "imageUrl")}
              alt={contentString(c, "title", "Wedding cake")}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          ) : null}
        </div>
        <div className="space-y-4">
          <p className="text-xs font-semibold tracking-widest text-bakery-700 uppercase">
            {contentString(c, "overline")}
          </p>
          <h2 className="font-heading text-3xl font-bold sm:text-4xl">
            {contentString(c, "title")}
          </h2>
          <p className="text-muted-foreground">{contentString(c, "description")}</p>
          <Button render={<a href={contentString(c, "ctaHref", "#inquiry")} />}>
            {contentString(c, "ctaLabel", "Request a Quote")}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </SectionShell>
  );
}

const whyIcons = { Award, Leaf, Truck, Palette } as const;

function WeddingWhyUsSection(props: WeddingSectionRendererProps) {
  const c = props.section.content;
  return (
    <SectionShell {...props}>
      <h2 className="font-heading mb-2 text-2xl font-bold sm:text-3xl">
        {contentString(c, "title", "Why Choose Us")}
      </h2>
      <p className="mb-8 max-w-2xl text-muted-foreground">
        {contentString(c, "description")}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {whyChooseUs.map((item) => {
          const Icon = whyIcons[item.icon as keyof typeof whyIcons] ?? Award;
          return (
            <div key={item.title} className="rounded-xl border border-border bg-white p-5">
              <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-cream-100 text-bakery-700">
                <Icon className="size-4" />
              </div>
              <h3 className="font-heading font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

function WeddingOffersSection(props: WeddingSectionRendererProps) {
  const c = props.section.content;
  const maxCount = contentNumber(c, "maxCount", 3);
  const offers = getWeddingOffers(maxCount);

  return (
    <SectionShell {...props}>
      <SectionHeader
        title={contentString(c, "title", "Wedding Offers")}
        description={contentString(c, "description")}
      />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {offers.map((offer) => (
          <article key={offer.id} className="overflow-hidden rounded-xl border border-border bg-white">
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
      </div>
    </SectionShell>
  );
}

function WeddingCollectionsSection(props: WeddingSectionRendererProps) {
  const c = props.section.content;
  const maxCount = contentNumber(c, "maxCount", 6);
  const cakes = getWeddingCollectionCakes(maxCount);

  return (
    <SectionShell {...props}>
      <h2 className="font-heading mb-2 text-2xl font-bold">
        {contentString(c, "title", "Wedding Collections")}
      </h2>
      <p className="mb-8 text-muted-foreground">{contentString(c, "description")}</p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cakes.map((cake) => (
          <Link
            key={cake.id}
            href={routes.store.cake(cake.slug)}
            className="overflow-hidden rounded-xl border border-border bg-white transition-colors hover:border-bakery-300"
          >
            <div className="relative aspect-[4/3] bg-cream-100">
              <Image src={cake.image} alt={cake.name} fill className="object-cover" sizes="33vw" />
            </div>
            <div className="p-4">
              <h3 className="font-heading font-semibold">{cake.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{cake.description}</p>
              <p className="mt-2 font-medium text-bakery-700">
                From {formatCurrency(cake.price)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </SectionShell>
  );
}

function WeddingGallerySection(props: WeddingSectionRendererProps) {
  const c = props.section.content;
  const maxCount = contentNumber(c, "maxCount", 8);
  const images = getWeddingGalleryImages(maxCount);

  return (
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
        description={contentString(c, "description")}
      />
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {images.map((src, index) => (
          <div
            key={src}
            className={cn(
              "relative overflow-hidden rounded-xl border border-border bg-muted",
              index % 3 === 0 ? "aspect-[4/5]" : "aspect-square"
            )}
          >
            <Image src={src} alt={`Wedding gallery ${index + 1}`} fill className="object-cover" sizes="200px" />
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

function WeddingTestimonialsSection(props: WeddingSectionRendererProps) {
  const c = props.section.content;
  const maxCount = contentNumber(c, "maxCount", 2);
  const allTestimonials = getStorefrontTestimonials();
  const weddingTestimonials = allTestimonials.filter((item) =>
    item.role.toLowerCase().includes("wedding")
  );
  const items = weddingTestimonials.length > 0 ? weddingTestimonials : allTestimonials;

  return (
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
        description={contentString(c, "description")}
      />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {items.slice(0, maxCount).map((item) => (
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
        <Accordion className="mt-8">
          {items.map((faq) => (
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
