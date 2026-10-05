/**
 * The tracking id inside whatever the shop pasted.
 *
 * Google does not hand anybody a bare "G-XXXXXXXXXX". Its setup panel gives a
 * whole `<script>` block and says to paste it into the site, so pasting that
 * block into a box labelled "Google Analytics (GA4)" is the obvious thing to do
 * — and it was accepted, saved, echoed back in the field, and counted as
 * configured on the settings index.
 *
 * The storefront then rendered nothing. `storefront-scripts.server.ts` tests
 * every stored id against `/^[A-Za-z0-9_-]{1,64}$/` and substitutes "" for
 * anything else — which is right, because an unchecked string goes into a
 * `<script>` tag — but it is silent, and it is a server away from the shop
 * owner. They never got a single pageview and nothing anywhere said why.
 *
 * So: pull the id out. Refusing a paste would be honest but unhelpful, because
 * the thing being refused is exactly what the provider told them to use.
 */

/** What each provider's id actually looks like, in the order we try them. */
const SHAPES: Record<string, RegExp> = {
  ga4: /\bG-[A-Z0-9]{4,20}\b/i,
  gtm: /\bGTM-[A-Z0-9]{4,20}\b/i,
  /**
   * Digits only, and deliberately NOT `\d+` alone: a pasted Meta snippet also
   * contains a version number and a timestamp, so the id is taken from the call
   * that carries it — `fbq('init', '123…')` — before falling back to the
   * longest bare run of digits.
   */
  pixel: /\bfbq\(\s*['"]init['"]\s*,\s*['"](\d{6,20})['"]/i,
  hotjar: /hjid\s*[:=]\s*(\d{5,12})/i,
};

/** A bare id the shop typed itself, which needs no extraction. */
const BARE = /^[A-Za-z0-9_-]{1,64}$/;

export type TrackingIdKind = "ga4" | "gtm" | "pixel" | "hotjar";

/**
 * Returns the id, or the trimmed input when nothing recognisable is in it.
 *
 * Never returns a partial: a value the caller cannot use comes back as the
 * shop typed it, so the form can say so rather than quietly storing a fragment.
 */
export function extractTrackingId(value: string, kind: TrackingIdKind): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  /**
   * Already an id, so say so and stop.
   *
   * A mutation proved this changes no answer: every bare id either matches its
   * own shape below or falls through to the same trimmed value. It stays as a
   * statement of the contract — a value the storefront would accept is returned
   * untouched, whatever the patterns underneath grow into.
   */
  if (BARE.test(trimmed)) return trimmed;

  const shape = SHAPES[kind];
  const found = shape?.exec(trimmed);
  if (found) return (found[1] ?? found[0]).trim();

  /**
   * A numeric provider with no recognisable call around it — someone pasted a
   * line of their dashboard. One run of digits is unambiguous; several is a
   * guess, and a guess that silently picks the wrong one is how this defect
   * started.
   */
  if (kind === "pixel" || kind === "hotjar") {
    const runs = trimmed.match(/\d{5,20}/g) ?? [];
    if (runs.length === 1) return runs[0]!;
  }

  return trimmed;
}

/** Whether a value will actually reach the storefront, or be dropped in silence. */
export function isUsableTrackingId(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 0 || BARE.test(trimmed);
}
