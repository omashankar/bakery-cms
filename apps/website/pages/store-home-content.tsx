"use client";

import { HomepageSectionRenderer } from "@/features/cms-sections/homepage-section-renderer";
import { StaggerReveal } from "@/components/shared/scroll-reveal";
import { layoutSpacing } from "@/constants/spacing";
import { cn } from "@/lib/utils";
import type { HomepageSectionInstance } from "@/types/homepage-builder";
import type { HomepageProductSource } from "@/features/products/lib/homepage-catalog";
import type { LandingCategory, LandingProduct } from "@/constants/landing-data";
import type { Banner } from "@/types/media";
import type { FaqItem, Testimonial } from "@/types/content";
import type { StorefrontInstagram } from "@/apps/website/lib/storefront-social.server";

interface StoreHomeContentProps {
  /** Sections fetched on the server, so they render into the HTML. */
  sections: HomepageSectionInstance[];
  /** Product rails built on the server, so both passes render the same cakes. */
  rails: Partial<Record<HomepageProductSource, LandingProduct[]>>;
  /** Active hero banners read from the server, so both passes render the same banners. */
  banners: Banner[];
  /** Categories read from the server, so both passes render the same category cards. */
  categories: LandingCategory[];
  /** Raw testimonials + faq read from the server, so both passes render the same. */
  testimonials: Testimonial[];
  faqs: FaqItem[];
  /** The shop's Instagram from Settings -> Social, read on the server. */
  instagram: StorefrontInstagram | null;
  /** Set by the server from ?cmsPreview=1 — shows the draft banner. */
  isPreview?: boolean;
}

export function StoreHomeContent({
  sections,
  rails,
  banners,
  categories,
  testimonials,
  faqs,
  instagram,
  isPreview = false,
}: StoreHomeContentProps) {
  return (
    <>
      {isPreview ? (
        <div className="border-b border-gold-300 bg-gold-50 px-4 py-2 text-center text-xs text-bakery-800">
          CMS preview mode — showing draft homepage content
        </div>
      ) : null}
      {renderSections(sections, rails, banners, categories, testimonials, faqs, instagram)}
    </>
  );
}

/**
 * Newsletter and CTA are both short centred cards — stacked they leave an awkward
 * vertical gap. When both are visible, render them side by side in a single row
 * (at the position of whichever comes first) so the page closes on one tidy band.
 */
function renderSections(
  sections: HomepageSectionInstance[],
  rails: Partial<Record<HomepageProductSource, LandingProduct[]>>,
  banners: Banner[],
  categories: LandingCategory[],
  testimonials: Testimonial[],
  faqs: FaqItem[],
  instagram: StorefrontInstagram | null
) {
  const idxNewsletter = sections.findIndex((s) => s.type === "newsletter");
  const idxCta = sections.findIndex((s) => s.type === "cta");
  const paired = idxNewsletter !== -1 && idxCta !== -1;
  const anchor = paired ? Math.min(idxNewsletter, idxCta) : -1;
  const other = paired ? Math.max(idxNewsletter, idxCta) : -1;

  return sections.map((section, index) => {
    if (paired && index === other) return null;

    if (paired && index === anchor) {
      return (
        <section key="newsletter-cta-row" className={cn("bg-white", layoutSpacing.sectionY)}>
          <div className={layoutSpacing.container}>
            <StaggerReveal className="grid items-stretch gap-6 lg:grid-cols-2">
              <HomepageSectionRenderer rails={rails} banners={banners} categories={categories} testimonials={testimonials} faqs={faqs} instagram={instagram} section={sections[idxNewsletter]} embedded />
              <HomepageSectionRenderer rails={rails} banners={banners} categories={categories} testimonials={testimonials} faqs={faqs} instagram={instagram} section={sections[idxCta]} embedded />
            </StaggerReveal>
          </div>
        </section>
      );
    }

    return (
      <HomepageSectionRenderer
        rails={rails}
        banners={banners}
        categories={categories}
        testimonials={testimonials}
        faqs={faqs}
        instagram={instagram}
        key={section.instanceId}
        section={section}
      />
    );
  });
}
