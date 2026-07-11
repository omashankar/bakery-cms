"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import {
  getPageForStorefront,
  processScheduledPagePublishes,
} from "@/features/admin/pages/lib/pages-repository";
import { whyChooseUs } from "@/constants/landing-data";
import { layoutSpacing } from "@/constants/spacing";
import type { CmsPage, CmsPageBlock } from "@/types/content";

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
      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.container}>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            {page.heroImage ? (
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border">
                <Image
                  src={page.heroImage}
                  alt={page.title}
                  fill
                  className="object-cover"
                  sizes="50vw"
                />
              </div>
            ) : null}
            <div className="space-y-4 text-muted-foreground">
              <p className="text-xs font-semibold tracking-widest text-bakery-700 uppercase">
                Our Story
              </p>
              {renderBlocks(page.blocks)}
            </div>
          </div>

          <div className="mt-16">
            <h2 className="font-heading mb-8 text-2xl font-bold">Why Choose Us</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {whyChooseUs.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-border bg-white p-5"
                >
                  <h3 className="font-heading font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
