"use client";

import { OptimizedImage } from "@/components/shared/optimized-image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimateOnScroll } from "@/components/shared/animate-on-scroll";
import { SectionHeader } from "@/components/shared/section-header";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import { cn } from "@/lib/utils";

// Varied aspect ratios drive the masonry rhythm inside the balanced CSS columns.
const aspects = ["aspect-[3/4]", "aspect-square", "aspect-[4/5]", "aspect-square"] as const;

/** One photograph the shop has uploaded. */
export interface GalleryPhoto {
  image: string;
  title?: string;
  tag?: string;
}

export function LandingGallery({
  showHeader = true,
  photos: given = [],
}: {
  showHeader?: boolean;
  /**
   * The shop's own photographs.
   *
   * This rendered `galleryImages` from landing-data — twelve stock Unsplash
   * photos of somebody else's cakes — as this shop's work, on the page whose
   * entire job is to show what it bakes. Empty renders an honest empty state
   * rather than another bakery's portfolio.
   */
  photos?: GalleryPhoto[];
}) {
  // A row with a caption but no picture is not a photograph. The editor lets an
  // admin type the caption first and choose the image later, and such a row
  // reached `<Image src="">` — a broken tile among the shop's real work. The
  // callers filter too; this is the last guard before the DOM.
  const photos = given.filter((photo) => photo.image?.trim());

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

        {photos.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
            Photographs of our work are on their way.
          </p>
        ) : (
        <AnimateOnScroll delay={showHeader ? 0.1 : 0}>
          <div className={cn("columns-2 gap-4 sm:columns-3 lg:columns-4", showHeader ? "mt-8" : "")}>
            {photos.map((photo, index) => {
              const src = photo.image;
              // The editor writes "" for an untouched column, never undefined,
              // so `?? "Gallery image N"` could not fire and the object literal
              // below was always truthy: every tile shipped alt="" and hovering
              // any of them dimmed the picture behind an empty white pill.
              const title = photo.title?.trim() ?? "";
              const tag = photo.tag?.trim() ?? "";
              return (
                <figure
                  key={`${src}-${index}`}
                  className={cn(
                    "group relative mb-4 block break-inside-avoid overflow-hidden rounded-2xl border border-border bg-cream-100",
                    aspects[index % aspects.length]
                  )}
                >
                  <OptimizedImage
                    src={src}
                    alt={title || `Gallery image ${index + 1}`}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {title || tag ? (
                    <figcaption className="absolute inset-0 flex flex-col justify-end bg-bakery-950/0 p-4 opacity-0 transition-all duration-300 group-hover:bg-bakery-950/45 group-hover:opacity-100">
                      {tag ? (
                        <span className="w-fit rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-bakery-800 uppercase">
                          {tag}
                        </span>
                      ) : null}
                      {title ? (
                        <span className="mt-2 font-heading text-sm font-semibold text-white">
                          {title}
                        </span>
                      ) : null}
                    </figcaption>
                  ) : null}
                </figure>
              );
            })}
          </div>
        </AnimateOnScroll>
        )}

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
