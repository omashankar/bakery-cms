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
import type { HomepageSectionInstance } from "@/types/homepage-builder";

export function StoreHomeContent() {
  const searchParams = useSearchParams();
  const isPreview = searchParams.get("cmsPreview") === "1";
  const [mounted, setMounted] = useState(false);
  const [sections, setSections] = useState<HomepageSectionInstance[]>([]);

  useEffect(() => {
    processScheduledHomepagePublish();
    const source = isPreview ? getDraftHomepageSections() : getPublishedHomepageSections();
    setSections(getVisibleSections(source));
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
      {sections.map((section) => (
        <HomepageSectionRenderer key={section.instanceId} section={section} />
      ))}
    </>
  );
}
