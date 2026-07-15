"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { WeddingSectionRenderer } from "@/features/cms-sections/wedding-section-renderer";
import {
  getDraftWeddingSections,
  getPublishedWeddingSections,
  getVisibleSections,
  processScheduledWeddingPublish,
} from "@/features/cms-sections/lib/wedding-store";
import type { WeddingSectionInstance } from "@/types/wedding-builder";

export function WeddingPageContent() {
  const searchParams = useSearchParams();
  const isPreview = searchParams.get("cmsPreview") === "wedding";
  const [mounted, setMounted] = useState(false);
  const [sections, setSections] = useState<WeddingSectionInstance[]>([]);

  useEffect(() => {
    processScheduledWeddingPublish();
    const source = isPreview ? getDraftWeddingSections() : getPublishedWeddingSections();
    // FAQs live only on the dedicated FAQ page — never render a wedding FAQ section
    // here, even if an older saved snapshot still contains one.
    setSections(getVisibleSections(source).filter((section) => section.type !== "wedding-faq"));
    setMounted(true);
  }, [isPreview]);

  if (!mounted) {
    return <div className="min-h-96 animate-pulse bg-cream-50" aria-hidden />;
  }

  return (
    <>
      {isPreview ? (
        <div className="border-b border-gold-300 bg-gold-50 px-4 py-2 text-center text-xs text-bakery-800">
          CMS preview mode — showing draft wedding page content
        </div>
      ) : null}
      {sections.map((section) => (
        <WeddingSectionRenderer key={section.instanceId} section={section} />
      ))}
    </>
  );
}
