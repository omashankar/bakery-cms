
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
