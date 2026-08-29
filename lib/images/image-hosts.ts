/**
 * Which hosts `next/image` will accept — one list, read by three callers.
 *
 * `next.config.ts` builds `images.remotePatterns` from this, the browser asks
 * it whether a given src is safe to optimise, and the tests compare our matcher
 * against Next's own. The list exists in exactly one place so the config and
 * the renderer cannot drift apart.
 *
 * Plain TypeScript on purpose: no "use client", no `server-only`, no `@/` alias.
 * `next.config.ts` imports it while resolving the config, before any of that is
 * available, and a client component imports it in the browser.
 */

export interface RemoteImagePattern {
  protocol: "https";
  hostname: string;
  pathname?: string;
}

/**
 * The Cloudinary account this shop uploads to, from either supported form of
 * the credentials — `CLOUDINARY_URL` (cloudinary://key:secret@cloud) or the
 * separate vars. Matches how lib/server/media/cloudinary.ts reads them.
 *
 * Takes the environment as an argument so a test can pin both forms without
 * mutating `process.env` for everything else in the run.
 */
export function resolveCloudinaryCloudName(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const direct = env.CLOUDINARY_CLOUD_NAME?.trim();
  if (direct) return direct;

  const url = env.CLOUDINARY_URL?.trim();
  if (!url) return undefined;
  try {
    return new URL(url).hostname || undefined;
  } catch {
    return undefined;
  }
}

/**
 * What the image optimiser is allowed to fetch.
 *
 * Scoped to the configured cloud rather than all of Cloudinary: the delivery
 * path is `/<cloud-name>/image/upload/...`, and the Next docs warn that an
 * unrestricted pattern lets anyone route arbitrary images through this shop's
 * optimiser. Without a cloud name there is nothing to scope to and nothing
 * being uploaded either, so the pattern stays open — this is the SERVER's list,
 * and it is unchanged from what the config shipped before.
 */
export function remoteImagePatterns(cloudName?: string): RemoteImagePattern[] {
  return [
    { protocol: "https", hostname: "images.unsplash.com" },
    {
      protocol: "https",
      hostname: "res.cloudinary.com",
      pathname: cloudName ? `/${cloudName}/**` : "/**",
    },
  ];
}

/**
 * Inlined into the browser bundle by the `env` key in next.config.ts, so no
 * shop has to set a new variable — it is derived from credentials they already
 * configured.
 *
 * Read as one whole expression and never destructured: the Next env guide is
 * explicit that destructuring `process.env` defeats the build-time inlining.
 */
const BUNDLE_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || undefined;

/**
 * What the BROWSER may assume, which is deliberately narrower than the server's.
 *
 * If the inlining ever fails on a shop that *is* configured, the permissive
 * `/**` fallback would classify a stranger's Cloudinary account as "optimize",
 * hand it to the loader, and throw — the exact bug this module exists to close,
 * reintroduced by its own fix. So the client fails the other way: an unknown
 * cloud name means no Cloudinary pattern at all, every Cloudinary URL renders
 * unoptimised, and nothing can throw. That costs some bytes; the alternative
 * costs the page.
 */
export function clientImagePatterns(
  cloudName: string | undefined = BUNDLE_CLOUD_NAME,
): RemoteImagePattern[] {
  const patterns = remoteImagePatterns(cloudName);
  return cloudName ? patterns : patterns.filter((p) => p.hostname !== "res.cloudinary.com");
}

/**
 * `optimize` — safe to hand to next/image's default loader.
 * `as-is`     — must be rendered with `unoptimized`, or it throws.
 * `placeholder` — there is no image here to render at all.
 */
export type ImageVerdict = "optimize" | "as-is" | "placeholder";

/**
 * A trailing `/**` is the only glob shape this config ships, so matching it is
 * a prefix test. Hand-rolled rather than importing Next's `match-remote-pattern`,
 * which pulls in a whole picomatch build — weight every storefront page would
 * carry. tests/domain/image-hosts-match-next-config.test.ts pins this function
 * against Next's own matcher so the shortcut cannot silently diverge.
 */
function matches(pattern: RemoteImagePattern, url: URL): boolean {
  if (url.protocol !== "https:") return false;
  if (url.hostname !== pattern.hostname) return false;
  if (!pattern.pathname) return true;
  const prefix = pattern.pathname.replace(/\*\*$/, "");
  return url.pathname.startsWith(prefix);
}

/**
 * Whether the picture lives on a host this shop does not control.
 *
 * Deliberately NOT `classifyImageSrc(...) === "as-is"`. That answers a different
 * question — "can next/image optimise it" — which is also false for our OWN
 * SVGs, for data URIs and for local paths. Using it to drive a warning told a
 * shop that the logo they had just uploaded to their own account "loads from
 * res.cloudinary.com", which is both alarming and wrong.
 */
export function isForeignImageHost(
  src: unknown,
  patterns: RemoteImagePattern[] = clientImagePatterns(),
): boolean {
  const value = typeof src === "string" ? src.trim() : "";
  if (!value) return false;
  // Ours by construction: an inline image, a dead blob, or a file we serve.
  if (value.startsWith("data:") || value.startsWith("blob:")) return false;
  if (value.startsWith("/")) return false;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    // Not an absolute URL, so there is no other host to name.
    return false;
  }

  return !patterns.some((pattern) => matches(pattern, url));
}

/**
 * Decide how a src must be rendered, mirroring the throws in this install's
 * next/image rather than guessing at them.
 *
 * Every branch below corresponds to something read in node_modules/next:
 *   E231 unconfigured host, E360 protocol-relative, E63 unparseable
 *        — image-loader.js:62-109, all inside `NODE_ENV !== 'production'`
 *   E871 local src with a query string — image-loader.js:55-61, and note that
 *        one sits OUTSIDE the dev guard
 *   E176/E21 leading or trailing whitespace — get-img-props.js:369-379
 *
 * That last pair is why callers must trim before calling: whitespace throws
 * before `unoptimized` is ever consulted, so `unoptimized` cannot save you
 * from it.
 */
export function classifyImageSrc(
  src: unknown,
  patterns: RemoteImagePattern[] = clientImagePatterns(),
): ImageVerdict {
  const value = typeof src === "string" ? src.trim() : "";
  if (!value) return "placeholder";

  // Dead across a reload — it cannot be shown from stored content, and
  // components/shared/safe-image.tsx already treats it as nothing.
  if (value.startsWith("blob:")) return "placeholder";

  // next/image forces `unoptimized` for these itself (get-img-props.js:272).
  if (value.startsWith("data:")) return "as-is";

  // E360. Must be checked before the leading-slash test below.
  if (value.startsWith("//")) return "as-is";

  if (value.startsWith("/")) {
    // E871. `localPatterns` is undefined in this repo's config, so today this
    // cannot actually throw — kept because the day someone adds localPatterns,
    // the wrong answer here is the one that takes a page down.
    return value.includes("?") ? "as-is" : "optimize";
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    // E63.
    return "as-is";
  }

  // next/image serves SVG as-is anyway unless dangerouslyAllowSVG is set, which
  // this config does not set.
  if (url.pathname.toLowerCase().endsWith(".svg")) return "as-is";

  return patterns.some((pattern) => matches(pattern, url)) ? "optimize" : "as-is";
}
