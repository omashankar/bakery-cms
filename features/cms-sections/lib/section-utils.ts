
import type {
  HeroCopySide,
  HeroLayout,
  HomepageSectionInstance,
} from "@/types/homepage-builder";

/**
 * SPLIT unless the shop asked for a banner, and anything unrecognised is split.
 *
 * The fallback is the load-bearing half, not the registry's default. Every hero
 * section stored before this key existed has no `layout` at all and nothing
 * migrates them, so a shop that has never opened the builder since reads its
 * layout HERE — the registry default only ever reaches sections created after
 * the deploy. Flip this to "banner" and every existing shop's homepage changes
 * shape without anyone touching it.
 */
export function heroLayoutOf(
  content: HomepageSectionInstance["content"],
): HeroLayout {
  return content.layout === "banner" ? "banner" : "split";
}

/**
 * Which half of a banner the words sit in — LEFT unless the shop said right.
 *
 * Same shape and same reason as `heroLayoutOf`: an unrecognised value is not
 * a request for a different hero, and every section stored before this key
 * existed has no value at all.
 */
export function heroCopySideOf(
  content: HomepageSectionInstance["content"],
): HeroCopySide {
  return content.copySide === "right" ? "right" : "left";
}

/**
 * The slides worth drawing — not the same list in the two layouts.
 *
 * A split slide can be words with no picture: the words are the half a
 * customer reads, and the empty frame beside them is already guarded. A banner
 * slide IS its picture — drawn edge to edge with the words laid over it — so
 * one with no image is a blank band the height of the hero, and the arrows and
 * dots would still count it. Dropped instead.
 */
export function heroSlidesFor<T extends { headline: string; imageUrl: string }>(
  layout: HeroLayout,
  slides: readonly T[],
): T[] {
  return slides.filter((slide) =>
    layout === "banner"
      ? Boolean(slide.imageUrl)
      : Boolean(slide.headline || slide.imageUrl),
  );
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
