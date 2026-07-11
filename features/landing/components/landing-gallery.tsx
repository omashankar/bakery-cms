"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimateOnScroll } from "@/components/shared/animate-on-scroll";
import { SectionHeader } from "@/components/shared/section-header";
import { Button } from "@/components/ui/button";
import { galleryImages } from "@/constants/landing-data";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import { cn } from "@/lib/utils";

export function LandingGallery({ showHeader = true }: { showHeader?: boolean }) {
  return (
    <section id="gallery" className={cn("scroll-mt-16 bg-white", layoutSpacing.sectionY)}>
      <div className={layoutSpacing.container}>
        {showHeader ? (
          <AnimateOnScroll>
            <SectionHeader
            overline="Visual Feast"
            title="Gallery"
            description="A glimpse into our world of sweet artistry and celebration moments."
            />
          </AnimateOnScroll>
        ) : null}

        <AnimateOnScroll delay={showHeader ? 0.1 : 0}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
            {galleryImages.map((src, index) => (
              <div
                key={`${src}-${index}`}
                className={cn(
                  "relative overflow-hidden rounded-xl border border-border bg-cream-100",
                  index % 3 === 0 ? "row-span-2 aspect-[3/4]" : "aspect-square"
                )}
              >
                <Image
                  src={src}
                  alt={`Gallery image ${index + 1}`}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover transition-transform duration-500 hover:scale-[1.02]"
                />
              </div>
            ))}
          </div>
        </AnimateOnScroll>

        {showHeader ? (
          <AnimateOnScroll className="mt-10 text-center" delay={0.2}>
            <Button variant="outline" render={<Link href={routes.store.gallery} />}>
              View Full Gallery
              <ArrowRight className="size-4" />
            </Button>
          </AnimateOnScroll>
        ) : null}
      </div>
    </section>
  );
}
