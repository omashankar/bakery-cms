/**
 * A cross-site POST, to be refused before anything else happens.
 *
 * `multipart/form-data` is a CORS-SAFELISTED content type, so a form on any
 * other site can post a file to the shop from a visitor's browser with no
 * preflight and no cooperation from us. Without this an upload endpoint's
 * budget is decorative: an attacker spends other people's addresses, and the
 * shop's own customers are the ones who hit the limit.
 *
 * `Sec-Fetch-Site` is the reliable signal in modern browsers and is not settable
 * by page script. `Origin` is the fallback for anything that does not send it.
 * Neither is a security boundary against a non-browser client — curl sends
 * whatever it likes — but these endpoints' threat is a page in somebody's tab,
 * and for that it is exact.
 *
 * Shared by the photo-cake upload and the customer's profile photo.
 */
export function isCrossSite(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "cross-site";

  const origin = request.headers.get("origin");
  /**
   * NEITHER header is refused, and that is the point of this check.
   *
   * It used to answer “not cross-site” here, which is exactly what a script
   * sends — so the guard stopped a form on another site and waved through the
   * curl loop it was written for. Every browser sends `Sec-Fetch-Site`, and
   * every browser sends `Origin` on a POST, so a real customer always carries
   * one of the two.
   */
  if (!origin) return true;
  const host = request.headers.get("host");
  try {
    return Boolean(host) && new URL(origin).host !== host;
  } catch {
    return true; // an Origin we cannot parse is not one we trust
  }
}
