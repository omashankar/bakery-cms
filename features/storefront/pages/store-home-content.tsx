"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getDraftHomepageSections,
  getPublishedHomepageSections,
  getVisibleSections,
  processScheduledHomepagePublish,
} from "@/features/cms-sections/lib/homepage-store";
import { HomepageSectionRenderer } from "@/features/cms-sections/homepage-section-renderer";
import { layoutSpacing } from "@/constants/spacing";
import { cn } from "@/lib/utils";
import type { HomepageSectionInstance } from "@/types/homepage-builder";

export function StoreHomeContent() {
  const searchParams = useSearchParams();
  const isPreview = searchParams.get("cmsPreview") === "1";
  const [mounted, setMounted] = useState(false);
  const [sections, setSections] = useState<HomepageSectionInstance[]>([]);

  useEffect(() => {
    processScheduledHomepagePublish();
    const source = isPreview ? getDraftHomepageSections() : getPublishedHomepageSections();
    // FAQs live only on the dedicated FAQ page — never render a home FAQ section
    // here, even if an older saved snapshot still contains one.
    setSections(getVisibleSections(source).filter((section) => section.type !== "faq"));
    setMounted(true);
  }, [isPreview]);

  if (!mounted) {
    return <div className="min-h-96 animate-pulse bg-cream-50" aria-hidden />;
  }

  return (
    <>
      {isPreview ? (
        <div className="border-b border-gold-300 bg-gold-50 px-4 py-2 text-center text-xs text-bakery-800">
          CMS preview mode — showing draft homepage content
        </div>
      ) : null}
      {renderSections(sections)}
    </>
  );
}

/**
 * Newsletter and CTA are both short centred cards — stacked they leave an awkward
 * vertical gap. When both are visible, render them side by side in a single row
 * (at the position of whichever comes first) so the page closes on one tidy band.
 */
function renderSections(sections: HomepageSectionInstance[]) {
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
              <HomepageSectionRenderer section={sections[idxNewsletter]} embedded />
              <HomepageSectionRenderer section={sections[idxCta]} embedded />
            </div>
          </div>
        </section>
      );
    }

    return <HomepageSectionRenderer key={section.instanceId} section={section} />;
  });
}
