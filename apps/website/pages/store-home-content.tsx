"use client";

import { HomepageSectionRenderer } from "@/features/cms-sections/homepage-section-renderer";
import { StaggerReveal } from "@/components/shared/scroll-reveal";
import { layoutSpacing } from "@/constants/spacing";
import { cn } from "@/lib/utils";
import type { HomepageSectionInstance } from "@/types/homepage-builder";
import type { HomepageProductSource } from "@/features/products/lib/homepage-catalog";
import type { LandingCategory, LandingOffer, LandingProduct } from "@/constants/landing-data";
import type { Banner } from "@/types/media";
import type { FaqItem, Testimonial } from "@/types/content";
import type { StorefrontInstagram } from "@/apps/website/lib/storefront-social.server";
import type { StorefrontLocation } from "@/apps/website/lib/storefront-location.server";
import type { StorefrontTrust } from "@/apps/website/lib/storefront-trust.server";

/**
 * Everything the sections need, read on the server.
 *
 * Bundled rather than passed as nine positional arguments: `renderSections`
 * forwards this to three separate `HomepageSectionRenderer` call sites, and a
 * positional list that long is one reordered argument away from rendering the
 * testimonials as the FAQ.
 */
interface HomepageSectionData {
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
  /** The shop's live coupons as offer cards — never the hardcoded demo offers. */
  offers: LandingOffer[];
  /** The shop's real address and hours from Settings -> Contact. */
  storeLocation: StorefrontLocation | null;
  /**
   * The shop's own rating, delivery speed and free-delivery threshold.
   *
   * Null when the settings read failed — every consumer renders nothing rather
   * than the demo constants these replaced.
   */
  trust: StorefrontTrust | null;
}

interface StoreHomeContentProps extends HomepageSectionData {
  /** Sections fetched on the server, so they render into the HTML. */
  sections: HomepageSectionInstance[];
  /** Set by the server from ?cmsPreview=1 — shows the draft banner. */
  isPreview?: boolean;
}

export function StoreHomeContent({
  sections,
  isPreview = false,
  ...data
}: StoreHomeContentProps) {
  return (
    <>
      {isPreview ? (
        <div className="border-b border-gold-300 bg-gold-50 px-4 py-2 text-center text-xs text-bakery-800">
          CMS preview mode — showing draft homepage content
        </div>
      ) : null}
      {renderSections(sections, data)}
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
  data: HomepageSectionData
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
              <HomepageSectionRenderer {...data} section={sections[idxNewsletter]} embedded />
              <HomepageSectionRenderer {...data} section={sections[idxCta]} embedded />
            </StaggerReveal>
          </div>
        </section>
      );
    }

    return (
      <HomepageSectionRenderer {...data} key={section.instanceId} section={section} />
    );
  });
}
