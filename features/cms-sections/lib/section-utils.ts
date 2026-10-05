
import type {
  HeroCopySide,
  HomepageSectionInstance,
  SectionAlign,
} from "@/types/homepage-builder";

/**
 * Which half of the picture the words sit in — LEFT unless the shop said right.
 *
 * An unrecognised value is not a request for something else, and every section
 * stored before this key existed has no value at all.
 */
export function heroCopySideOf(
  content: HomepageSectionInstance["content"],
): HeroCopySide {
  return content.copySide === "right" ? "right" : "left";
}

/**
 * Which edge the shop asked this heading to sit against.
 *
 * THE FALLBACK IS THE CALLER'S, and that is the whole reason this takes
 * one. Eleven section types draw their heading left and twelve draw it
 * centred; every layout published before this key existed carries no
 * `align` at all, so the fallback is not an edge case — it is what every
 * band on every live page is using. A default baked in here would move
 * eleven of them.
 *
 * An unrecognised value is not a request for something else.
 */
export function sectionAlignOf(
  content: HomepageSectionInstance["content"],
  fallback: SectionAlign,
): SectionAlign {
  const value = content.align;
  return value === "left" || value === "center" || value === "right"
    ? value
    : fallback;
}

/**
 * The slides worth drawing: the ones that have a picture.
 *
 * A hero slide IS its picture — drawn edge to edge with the words laid over
 * it — so one with no image is a blank band the height of the hero, and the
 * arrows and dots would still count it. Dropped instead.
 *
 * This used to take the layout as well, because the hero the shop could also
 * choose was words in a column beside a frame, and there a slide with no
 * picture was still worth drawing. That hero is gone.
 */
export function heroSlidesFor<T extends { headline: string; imageUrl: string }>(
  slides: readonly T[],
): T[] {
  return slides.filter((slide) => Boolean(slide.imageUrl));
}

export function sortSections<T extends { order: number }>(sections: T[]): T[] {
  return [...sections]
    .sort((a, b) => a.order - b.order)
    .map((section, index) => ({ ...section, order: index }));
}

export function getVisibleSections<T extends { isVisible: boolean; order: number }>(
  sections: T[]
): T[] {
  return sortSections(sections).filter((section) => section.isVisible);
}

/**
 * The newsletter and the CTA share one band when both are on the page.
 *
 * The storefront pairs them: it renders both `embedded`, side by side, at
 * whichever of the two comes FIRST, and drops the later one from its own slot.
 * The builder preview did not, so it drew each full-width where it sat — and an
 * admin who dragged the CTA to the bottom of the page saw it at the bottom,
 * published, and got it beside the newsletter halfway up.
 *
 * The rule lives here so both surfaces read the same one. Returns null when
 * only one of the two is present, which is when there is nothing to pair.
 */
export function planNewsletterCtaPair<
  T extends { instanceId: string; type: string },
>(sections: T[]): { anchorId: string; otherId: string; newsletter: T; cta: T } | null {
  const newsletterIndex = sections.findIndex((section) => section.type === "newsletter");
  const ctaIndex = sections.findIndex((section) => section.type === "cta");
  if (newsletterIndex === -1 || ctaIndex === -1) return null;

  const first = Math.min(newsletterIndex, ctaIndex);
  const last = Math.max(newsletterIndex, ctaIndex);

  return {
    anchorId: sections[first].instanceId,
    otherId: sections[last].instanceId,
    newsletter: sections[newsletterIndex],
    cta: sections[ctaIndex],
  };
}
