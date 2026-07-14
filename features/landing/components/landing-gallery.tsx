"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimateOnScroll } from "@/components/shared/animate-on-scroll";
import { SectionHeader } from "@/components/shared/section-header";
import { Button } from "@/components/ui/button";
import { galleryCaptions, galleryImages } from "@/constants/landing-data";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import { cn } from "@/lib/utils";

// Varied aspect ratios drive the masonry rhythm inside the balanced CSS columns.
const aspects = ["aspect-[3/4]", "aspect-square", "aspect-[4/5]", "aspect-square"] as const;

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
          <div className={cn("columns-2 gap-4 sm:columns-3 lg:columns-4", showHeader ? "mt-8" : "")}>
            {galleryImages.map((src, index) => {
              const caption = galleryCaptions[index];
              return (
                <figure
                  key={`${src}-${index}`}
                  className={cn(
                    "group relative mb-4 block break-inside-avoid overflow-hidden rounded-2xl border border-border bg-cream-100",
                    aspects[index % aspects.length]
                  )}
                >
                  <Image
                    src={src}
                    alt={caption?.title ?? `Gallery image ${index + 1}`}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {caption ? (
                    <figcaption className="absolute inset-0 flex flex-col justify-end bg-bakery-950/0 p-4 opacity-0 transition-all duration-300 group-hover:bg-bakery-950/45 group-hover:opacity-100">
                      <span className="w-fit rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-bakery-800 uppercase">
                        {caption.tag}
                      </span>
                      <span className="mt-2 font-heading text-sm font-semibold text-white">
                        {caption.title}
                      </span>
                    </figcaption>
                  ) : null}
                </figure>
              );
            })}
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
