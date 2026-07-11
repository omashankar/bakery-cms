import type { WeddingSectionInstance } from "@/types/wedding-builder";

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
