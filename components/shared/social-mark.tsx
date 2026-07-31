import { cn } from "@/lib/utils";

import { SOCIAL_ICON_PATHS } from "./social-icon-paths";

/**
 * The brand mark for a social platform.
 *
 * The footer used a lucide lookup that mapped `Instagram: Share2` and
 * `Facebook: Globe` and covered four of the eight platforms the picker offers —
 * so Instagram, Twitter, LinkedIn, Pinterest and TikTok all rendered the same
 * generic share arrow. Choosing a platform changed the label and nothing a
 * visitor could see.
 *
 * The paths come from `simple-icons` (CC0) and `bootstrap-icons` (MIT) via
 * `scripts/generate-social-icons.mjs` — two sources because neither covers all
 * eight on its own. Generated rather than imported so a client bundle does not
 * pull in several thousand icons for the sake of these, and generated rather
 * than hand-written because hand-written was tried first and was wrong in ways
 * no diff shows: a subpath wound the wrong way punched a hole through one arm of
 * the Twitter mark, and Instagram collapsed to a solid square with its lens and
 * flash contributing nothing.
 *
 * The letter mark below is now only for a platform outside the supported list —
 * reachable from a document written before the settings schema closed that
 * field.
 */

/** True when this platform has a real brand glyph rather than a letter mark. */
export function hasSocialGlyph(platform: string): boolean {
  return Object.hasOwn(SOCIAL_ICON_PATHS, platform);
}

/** The letter mark for a platform without a glyph. */
export function socialLetterMark(platform: string): string {
  // Trimmed and capped: this is unvalidated text from an old document, and it
  // has to fit a 16px box next to real glyphs.
  return platform.trim().slice(0, 2) || "?";
}

export function SocialMark({ platform, className }: { platform: string; className?: string }) {
  if (hasSocialGlyph(platform)) {
    const icon = SOCIAL_ICON_PATHS[platform];
    return (
      <svg
        // From the icon, not hardcoded: the two sources draw in different
        // coordinate spaces (24x24 and 16x16), and forcing one viewBox on the
        // other renders it clipped or shrunk into a corner.
        viewBox={icon.viewBox}
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
        className={cn("size-4", className)}
      >
        <path d={icon.path} />
      </svg>
    );
  }

  const mark = socialLetterMark(platform);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-4 items-center justify-center font-heading font-semibold leading-none",
        mark.length > 1 ? "text-[10px] tracking-tight" : "text-[13px]",
        className
      )}
    >
      {mark}
    </span>
  );
}
