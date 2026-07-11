"use client";

import { useEffect, useRef } from "react";
import { StorefrontLightFrame } from "@/components/shared/storefront-light-frame";
import { getVisibleSections } from "@/features/cms-sections/lib/section-utils";
import type { BuilderSectionListItem } from "./section-list-panel";

interface BuilderPreviewPanelProps<T extends BuilderSectionListItem> {
  sections: T[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  renderSection: (
    section: T,
    props: { selected: boolean; onSelect: () => void }
  ) => React.ReactNode;
}

export function BuilderPreviewPanel<T extends BuilderSectionListItem>({
  sections,
  selectedId,
  onSelect,
  renderSection,
}: BuilderPreviewPanelProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const visibleSections = getVisibleSections(sections);

  useEffect(() => {
    if (!selectedId || !containerRef.current) return;
    const target = containerRef.current.querySelector(
      `[data-section-id="${selectedId}"]`
    );
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedId]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">Preview</p>
        <p className="text-xs text-muted-foreground">
          Same light sections as live store · Publish to update the public page
        </p>
      </div>
      <div
        ref={containerRef}
        className="panel-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted"
      >
        <StorefrontLightFrame className="mx-auto min-h-full max-w-5xl shadow-sm">
          {visibleSections.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center bg-cream-50 p-8 text-center text-sm text-muted-foreground">
              All sections are hidden. Enable at least one section to preview.
            </div>
          ) : (
            visibleSections.map((section) =>
              renderSection(section, {
                selected: selectedId === section.instanceId,
                onSelect: () => onSelect(section.instanceId),
              })
            )
          )}
        </StorefrontLightFrame>
      </div>
    </div>
  );
}
