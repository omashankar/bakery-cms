"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Award, Heart, Leaf, Palette, Truck } from "lucide-react";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import {
  getPageForStorefront,
  processScheduledPagePublishes,
} from "@/features/content/lib/pages-repository";
import { ScrollReveal, StaggerReveal } from "@/components/shared/scroll-reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { whyChooseUs } from "@/constants/landing-data";
import { layoutSpacing } from "@/constants/spacing";
import { cn } from "@/lib/utils";
import type { CmsPage, CmsPageBlock } from "@/types/content";

const aboutWhyIcons = { Award, Leaf, Truck, Palette } as const;

const aboutStats = [
  { value: "60+", label: "Years of baking" },
  { value: "1M+", label: "Happy customers" },
  { value: "500+", label: "Cake varieties" },
  { value: "4.9★", label: "Average rating" },
] as const;

function renderBlocks(blocks: CmsPageBlock[]) {
  return blocks.map((block) => {
    if (block.type === "heading") {
      return (
        <h2 key={block.id} className="font-heading text-2xl font-bold text-foreground">
          {block.content}
        </h2>
      );
    }
    return (
      <p key={block.id} className="text-sm leading-relaxed sm:text-base">
        {block.content}
      </p>
    );
  });
}

interface CmsPageViewProps {
  slug: string;
}

export function CmsPageView({ slug }: CmsPageViewProps) {
  return (
    <Suspense
      fallback={
        <div className={layoutSpacing.container}>
          <div className="min-h-48 animate-pulse rounded-xl border border-border bg-cream-50" />
        </div>
      }
    >
      <CmsPageViewContent slug={slug} />
    </Suspense>
  );
}

function CmsPageViewContent({ slug }: CmsPageViewProps) {
  const searchParams = useSearchParams();
  const preview = searchParams.get("preview") === "1";
  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState<CmsPage | null>(null);

  useEffect(() => {
    processScheduledPagePublishes();
    setPage(getPageForStorefront(slug, preview));
    setMounted(true);
  }, [slug, preview]);

  useEffect(() => {
    if (!page?.seo?.metaTitle) return;
    document.title = page.seo.metaTitle;
  }, [page?.seo?.metaTitle]);

  if (!mounted) {
    return (
      <div className={layoutSpacing.container}>
        <div className="min-h-48 animate-pulse rounded-xl border border-border bg-cream-50" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className={layoutSpacing.container}>
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          This page is not available or has not been published yet.
        </div>
      </div>
    );
  }

  if (page.template === "about") {
    return <AboutTemplate page={page} preview={preview} />;
  }

  return <StandardTemplate page={page} preview={preview} />;
}

function StandardTemplate({ page, preview }: { page: CmsPage; preview: boolean }) {
  return (
    <>
      {preview ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
          Draft preview — this page is not visible to customers until published.
        </div>
      ) : null}
      <StorePageHeader
        title={page.title}
        description={page.description}
        breadcrumbs={[{ label: page.title }]}
      />
      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.containerNarrow}>
          <div className="space-y-6 rounded-xl border border-border bg-white p-6 text-muted-foreground sm:p-8">
            {renderBlocks(page.blocks)}
          </div>
        </div>
      </section>
    </>
  );
}

function AboutTemplate({ page, preview }: { page: CmsPage; preview: boolean }) {
  return (
    <>
      {preview ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
          Draft preview — this page is not visible to customers until published.
        </div>
      ) : null}
      <StorePageHeader
        title={page.title}
        description={page.description}
        breadcrumbs={[{ label: page.title }]}
      />

      {/* Our Story */}
      <section className={cn("bg-white", layoutSpacing.sectionY)}>
        <div className={layoutSpacing.container}>
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            {page.heroImage ? (
              <ScrollReveal className="relative mx-auto w-full max-w-lg lg:max-w-none">
                <div className="rounded-[2rem] border border-border bg-cream-100 p-2.5 shadow-md">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-muted">
                    <Image
                      src={page.heroImage}
                      alt={page.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 45vw"
                    />
                  </div>
                </div>
                <div className="absolute bottom-5 left-5 rounded-2xl border border-border bg-white/95 px-4 py-3 shadow-sm">
                  <p className="font-heading text-2xl font-bold text-bakery-700">Since 1956</p>
                  <p className="text-[11px] text-muted-foreground">Baking joy for generations</p>
                </div>
              </ScrollReveal>
            ) : null}
            <ScrollReveal delay={120} className="space-y-5 text-muted-foreground">
              <Badge variant="accent" className="gap-1.5 rounded-full px-3.5 py-1.5 text-[13px]">
                <Heart className="size-3.5" />
                Our Story
              </Badge>
              {renderBlocks(page.blocks)}
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="surface-cream border-y border-border py-12 lg:py-14">
        <div className={layoutSpacing.container}>
          <StaggerReveal className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {aboutStats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-heading text-3xl font-bold text-bakery-800 sm:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </StaggerReveal>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className={cn("bg-white", layoutSpacing.sectionY)}>
        <div className={layoutSpacing.container}>
          <ScrollReveal className="max-w-2xl">
            <h2 className="font-heading text-2xl font-bold sm:text-3xl">Why Choose Us</h2>
            <p className="mt-2 text-muted-foreground">
              Six decades of craft, quality, and care in every celebration we bake for.
            </p>
          </ScrollReveal>
          <StaggerReveal className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {whyChooseUs.map((item) => {
              const Icon = aboutWhyIcons[item.icon as keyof typeof aboutWhyIcons] ?? Award;
              return (
                <div
                  key={item.title}
                  className="h-full rounded-2xl border border-border bg-white p-5 transition-all hover:border-bakery-300 hover:shadow-sm"
                >
                  <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-cream-100 text-bakery-700">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="font-heading font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </StaggerReveal>
        </div>
      </section>

      {/* CTA */}
      <section className={cn("bg-white pb-16 lg:pb-20")}>
        <div className={layoutSpacing.container}>
          <ScrollReveal className="rounded-3xl border border-border bg-cream-100 px-6 py-12 text-center sm:px-10 lg:py-14">
            <h2 className="font-heading text-2xl font-bold sm:text-3xl">
              Ready to make your celebration sweeter?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Explore our handcrafted cakes and desserts, or reach out for a custom creation
              tailored to your special day.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" className="rounded-xl" render={<Link href={routes.store.collections} />}>
                Browse Cakes
                <ArrowRight className="size-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-xl"
                render={<Link href={routes.store.contact} />}
              >
                Contact Us
              </Button>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
