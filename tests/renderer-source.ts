import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The homepage section renderer, read as the whole of what it draws with.
 *
 * It used to be one client-component file. It is a server component now, and
 * the bands that have to run in the browser — the banner strip, the countdown,
 * recently viewed, the scrolling row and the tab switch — live in their own
 * client files beside it, with the pieces they share in `section-parts.tsx`.
 * The guards here were written against the single file and look a band up by
 * its `function Name(`; this hands them the family, so a band that moved
 * files is still found, and a band that was deleted is still missed.
 */
export const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";

export const RENDERER_FAMILY = [
  RENDERER,
  "features/cms-sections/section-parts.tsx",
  "features/cms-sections/scroll-strip.tsx",
  "features/cms-sections/tabbed-rail-tabs.tsx",
  "features/cms-sections/banner-strip-section.tsx",
  "features/cms-sections/same-day-countdown-section.tsx",
  "features/cms-sections/recently-viewed-section.tsx",
];

/** A source file by repo path — the renderer as its family, anything else as itself. */
export function readSource(path: string): string {
  const files = path === RENDERER ? RENDERER_FAMILY : [path];
  return files.map((file) => readFileSync(join(process.cwd(), file), "utf8")).join("\n");
}
