"use client";

import { WeddingSectionRenderer } from "@/features/cms-sections/wedding-section-renderer";
import type { WeddingSectionInstance } from "@/types/wedding-builder";
import type { LandingOffer, LandingProduct } from "@/constants/landing-data";
import type { FaqItem, Testimonial } from "@/types/content";

interface WeddingPageContentProps {
  /** Sections fetched on the server, so they render into the HTML. */
  sections: WeddingSectionInstance[];
  /** Wedding cakes + offers read on the server, so both passes render the same. */
  weddingProducts: LandingProduct[];
  weddingOffers: LandingOffer[];
  /** Raw testimonials + faq read on the server, so both passes render the same. */
  testimonials: Testimonial[];
  faqs: FaqItem[];
  /** Set by the server from ?cmsPreview=wedding — shows the draft banner. */
  isPreview?: boolean;
}

export function WeddingPageContent({
  sections,
  weddingProducts,
  weddingOffers,
  testimonials,
  faqs,
  isPreview = false,
}: WeddingPageContentProps) {
  return (
    <>
      {isPreview ? (
        <div className="border-b border-gold-300 bg-gold-50 px-4 py-2 text-center text-xs text-bakery-800">
          CMS preview mode — showing draft wedding page content
        </div>
      ) : null}
      {sections.map((section) => (
        <WeddingSectionRenderer
          key={section.instanceId}
          section={section}
          weddingProducts={weddingProducts}
          weddingOffers={weddingOffers}
          testimonials={testimonials}
          faqs={faqs}
        />
      ))}
    </>
  );
}
