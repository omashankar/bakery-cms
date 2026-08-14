/**
 * The caller's IP address, or nothing — never a value the caller chose.
 *
 * `x-forwarded-for` is written by the CLIENT unless something upstream
 * overwrites it. A reverse proxy APPENDS rather than replaces
 * (`proxy_add_x_forwarded_for` yields `<whatever the client sent>, <real ip>`),
 * and with no proxy at all the header is entirely attacker-supplied.
 *
 * Maintenance mode learned this when its IP allow-list became an access
 * decision, and guarded itself accordingly. The login throttle is an access
 * decision too and did not: it keyed on `requestContext`'s IP, which took the
 * FIRST hop — the one the caller wrote — and the rate limiter mints a fresh
 * bucket for any key it has not seen. So "Max login attempts: 3" was three
 * attempts per header value, and one extra header per request reset it. The
 * same key throttled password-reset mail, so the shop's SMTP account could be
 * pumped the same way.
 *
 * Two rules, both from the maintenance module:
 *   - believe the header only where the deployment says it is trustworthy
 *     (`TRUST_PROXY_HEADERS=true`), and
 *   - take the LAST hop when it is, because the earlier entries are whatever
 *     the caller sent.
 *
 * Returning "" on an untrusted deployment loses nothing real: an IP nobody can
 * vouch for was never evidence, and recording it in the audit trail makes the
 * trail forgeable. Callers that used it as a rate-limit key must therefore also
 * key on something the caller cannot rotate — see `loginController`.
 */
export function proxyHeadersAreTrusted(): boolean {
  return process.env.TRUST_PROXY_HEADERS === "true";
}

export function clientIpFrom(headers: Headers): string {
  if (!proxyHeadersAreTrusted()) return "";

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    const last = hops.at(-1);
    if (last) return last;
  }
  return headers.get("x-real-ip")?.trim() ?? "";
}
