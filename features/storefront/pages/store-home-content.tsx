"use client";

import { HomepageSectionRenderer } from "@/features/cms-sections/homepage-section-renderer";
import { layoutSpacing } from "@/constants/spacing";
import { cn } from "@/lib/utils";
import type { HomepageSectionInstance } from "@/types/homepage-builder";
import type { HomepageProductSource } from "@/features/storefront/lib/homepage-catalog";
import type { LandingProduct } from "@/constants/landing-data";

interface StoreHomeContentProps {
  /** Sections fetched on the server, so they render into the HTML. */
  sections: HomepageSectionInstance[];
  /** Product rails built on the server, so both passes render the same cakes. */
  rails: Partial<Record<HomepageProductSource, LandingProduct[]>>;
  /** Set by the server from ?cmsPreview=1 — shows the draft banner. */
  isPreview?: boolean;
}

export function StoreHomeContent({ sections, rails, isPreview = false }: StoreHomeContentProps) {
  return (
    <>
      {isPreview ? (
        <div className="border-b border-gold-300 bg-gold-50 px-4 py-2 text-center text-xs text-bakery-800">
          CMS preview mode — showing draft homepage content
        </div>
      ) : null}
      {renderSections(sections, rails)}
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
  rails: Partial<Record<HomepageProductSource, LandingProduct[]>>
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
            <div className="grid items-stretch gap-6 lg:grid-cols-2">
              <HomepageSectionRenderer rails={rails} section={sections[idxNewsletter]} embedded />
              <HomepageSectionRenderer rails={rails} section={sections[idxCta]} embedded />
            </div>
          </div>
        </section>
      );
    }

    return <HomepageSectionRenderer rails={rails} key={section.instanceId} section={section} />;
  });
}
