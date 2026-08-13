"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award, Heart, Leaf, Palette, Truck } from "lucide-react";
import { StorePageHeader } from "@/apps/website/components/store-page-header";
import { ScrollReveal, StaggerReveal } from "@/components/shared/scroll-reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import { cn } from "@/lib/utils";
import type { CmsPage, CmsPageAboutContent, CmsPageBlock } from "@/types/content";

const aboutWhyIcons = { Award, Leaf, Truck, Palette } as const;

function renderBlocks(blocks: CmsPageBlock[]) {
  return blocks.map((block) => {
    if (block.type === "heading") {
      return (
        <h2
          key={block.id}
          className="mt-8 mb-3 font-heading text-2xl font-bold text-foreground first:mt-0"
        >
          {block.content}
        </h2>
      );
    }
    return (
      <p key={block.id} className="mt-4 text-sm leading-relaxed first:mt-0 sm:text-base">
        {block.content}
      </p>
    );
  });
}

interface CmsPageViewProps {
  /** Page fetched on the server, so its content renders into the HTML. */
  page: CmsPage | null;
  /** Set by the server from ?preview=1 — shows the draft banner. */
  preview?: boolean;
}

export function CmsPageView({ page, preview = false }: CmsPageViewProps) {
  if (!page) {
    return (
      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.containerNarrow}>
          <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
            This page is not available or has not been published yet.
          </div>
        </div>
      </section>
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
          <div className="mx-auto max-w-2xl rounded-xl border border-border bg-white p-6 text-foreground sm:p-8">
            {renderBlocks(page.blocks)}
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * The About page's own copy, normalised once.
 *
 * A stored document can hold anything — this collection is `Mixed` in Mongo and
 * both page routes cast the request body rather than validating it — so an
 * `about` written by a hand-edited record or a legacy import must not be able to
 * throw the whole storefront page. Everything comes back as a trimmed string or
 * a real array.
 */
function readAboutContent(page: CmsPage) {
  const about = (page.about ?? {}) as CmsPageAboutContent;
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

  const stats = (Array.isArray(about.stats) ? about.stats : [])
    .map((stat, index) => ({
      id: typeof stat?.id === "string" && stat.id ? stat.id : `stat-${index}`,
      value: text(stat?.value),
      label: text(stat?.label),
    }))
    .filter((stat) => stat.value || stat.label);

  const highlights = (Array.isArray(about.highlights) ? about.highlights : [])
    .map((item, index) => ({
      id: typeof item?.id === "string" && item.id ? item.id : `highlight-${index}`,
      icon: text(item?.icon),
      title: text(item?.title),
      description: text(item?.description),
    }))
    .filter((item) => item.title || item.description);

  return {
    badgeTitle: text(about.badgeTitle),
    badgeSubtitle: text(about.badgeSubtitle),
    storyLabel: text(about.storyLabel),
    stats,
    highlightsTitle: text(about.highlightsTitle),
    highlightsDescription: text(about.highlightsDescription),
    highlights,
    ctaTitle: text(about.ctaTitle),
    ctaDescription: text(about.ctaDescription),
    ctaPrimaryLabel: text(about.ctaPrimaryLabel),
    ctaSecondaryLabel: text(about.ctaSecondaryLabel),
  };
}

function AboutTemplate({ page, preview }: { page: CmsPage; preview: boolean }) {
  /**
   * Every claim on this page used to be a constant.
   *
   * "Since 1965", "60+ Years of baking", "1M+ Happy customers", "500+ Cake
   * varieties", "4.9★", "Six decades of craft…" and four cards asserting six
   * decades of expertise and same-day delivery across 500+ cities — all the
   * DEMO brand's history, rendered as the shop's own on any page using this
   * template, with no field anywhere to change or remove them.
   *
   * They are page data now, and each section renders only when it has
   * something true to say.
   */
  const about = readAboutContent(page);

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
                {about.badgeTitle || about.badgeSubtitle ? (
                  <div className="absolute bottom-5 left-5 rounded-2xl border border-border bg-white/95 px-4 py-3 shadow-sm">
                    {about.badgeTitle ? (
                      <p className="font-heading text-2xl font-bold text-bakery-700">
                        {about.badgeTitle}
                      </p>
                    ) : null}
                    {about.badgeSubtitle ? (
                      <p className="text-[11px] text-muted-foreground">{about.badgeSubtitle}</p>
                    ) : null}
                  </div>
                ) : null}
              </ScrollReveal>
            ) : null}
            <ScrollReveal delay={120} className="space-y-5 text-muted-foreground">
              {about.storyLabel ? (
                <Badge variant="accent" className="gap-1.5 rounded-full px-3.5 py-1.5 text-[13px]">
                  <Heart className="size-3.5" />
                  {about.storyLabel}
                </Badge>
              ) : null}
              {renderBlocks(page.blocks)}
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Stats band — absent entirely until the shop has filled it in. */}
      {about.stats.length > 0 ? (
      <section className="surface-cream border-y border-border py-12 lg:py-14">
        <div className={layoutSpacing.container}>
          <StaggerReveal className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {about.stats.map((stat) => (
              // Keyed by id: two rows an admin typed the same label into would
              // otherwise collide.
              <div key={stat.id} className="text-center">
                <p className="font-heading text-3xl font-bold text-bakery-800 sm:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </StaggerReveal>
        </div>
      </section>
      ) : null}

      {/* Why Choose Us — heading, copy and cards each stand on their own. */}
      {about.highlightsTitle || about.highlightsDescription || about.highlights.length > 0 ? (
      <section className={cn("bg-white", layoutSpacing.sectionY)}>
        <div className={layoutSpacing.container}>
          {about.highlightsTitle || about.highlightsDescription ? (
            <ScrollReveal className="max-w-2xl">
              {about.highlightsTitle ? (
                <h2 className="font-heading text-2xl font-bold sm:text-3xl">
                  {about.highlightsTitle}
                </h2>
              ) : null}
              {about.highlightsDescription ? (
                <p className="mt-2 text-muted-foreground">{about.highlightsDescription}</p>
              ) : null}
            </ScrollReveal>
          ) : null}
          <StaggerReveal className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {about.highlights.map((item) => {
              const Icon = aboutWhyIcons[item.icon as keyof typeof aboutWhyIcons] ?? Award;
              return (
                <div
                  key={item.id}
                  className="h-full rounded-2xl border border-border bg-white p-5 transition-all hover:border-bakery-300 hover:shadow-sm"
                >
                  <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-cream-100 text-bakery-700">
                    <Icon className="size-5" />
                  </div>
                  {item.title ? (
                    <h3 className="font-heading font-semibold">{item.title}</h3>
                  ) : null}
                  {item.description ? (
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </StaggerReveal>
        </div>
      </section>
      ) : null}

      {/* CTA — each button appears only if it has been given a label. */}
      {about.ctaTitle || about.ctaDescription || about.ctaPrimaryLabel || about.ctaSecondaryLabel ? (
      <section className={cn("bg-white pb-16 lg:pb-20")}>
        <div className={layoutSpacing.container}>
          <ScrollReveal className="rounded-3xl border border-border bg-cream-100 px-6 py-12 text-center sm:px-10 lg:py-14">
            {about.ctaTitle ? (
              <h2 className="font-heading text-2xl font-bold sm:text-3xl">{about.ctaTitle}</h2>
            ) : null}
            {about.ctaDescription ? (
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{about.ctaDescription}</p>
            ) : null}
            {about.ctaPrimaryLabel || about.ctaSecondaryLabel ? (
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                {about.ctaPrimaryLabel ? (
                  <Button
                    size="lg"
                    className="rounded-xl"
                    render={<Link href={routes.store.collections} />}
                  >
                    {about.ctaPrimaryLabel}
                    <ArrowRight className="size-4" />
                  </Button>
                ) : null}
                {about.ctaSecondaryLabel ? (
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-xl"
                    render={<Link href={routes.store.contact} />}
                  >
                    {about.ctaSecondaryLabel}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </ScrollReveal>
        </div>
      </section>
      ) : null}
    </>
  );
}
