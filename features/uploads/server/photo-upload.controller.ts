import { getCustomerSession } from "@/lib/server/auth/customer-dal";
import { clientIpFrom } from "@/lib/server/http/client-ip";
import { AppError, ValidationError, withErrorHandler } from "@/lib/server/http/errors";
import { rateLimit } from "@/lib/server/http/rate-limit";
import { ok } from "@/lib/server/http/response";

import { uploadPhotoCakeImage } from "./photo-upload.service";

const HOUR = 60 * 60 * 1000;

/**
 * A cross-site POST, refused before anything else happens.
 *
 * `multipart/form-data` is a CORS-SAFELISTED content type, so a form on any
 * other site can post here from a visitor's browser with no preflight and no
 * cooperation from us. Without this the per-IP budget below is decorative:
 * an attacker spends other people's addresses, and the shop's own customers are
 * the ones who hit the limit.
 *
 * `Sec-Fetch-Site` is the reliable signal in modern browsers and is not settable
 * by page script. `Origin` is the fallback for anything that does not send it.
 * Neither is a security boundary against a non-browser client — curl sends
 * whatever it likes — but this endpoint's threat is a page in somebody's tab,
 * and for that it is exact.
 */
function isCrossSite(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "cross-site";

  const origin = request.headers.get("origin");
  if (!origin) return false; // no browser context claimed at all
  const host = request.headers.get("host");
  try {
    return Boolean(host) && new URL(origin).host !== host;
  } catch {
    return true; // an Origin we cannot parse is not one we trust
  }
}

/**
 * A customer's photo, for a photo cake. NO SIGN-IN.
 *
 * This required an account, and the reasoning was sound: it is the only upload a
 * member of the public can reach, and an account is a thing that cannot be
 * rotated for free. What it cost was the sale. A first-time visitor who had
 * chosen a photo cake and pressed Upload was asked for a phone number and an OTP
 * BEFORE they had bought anything — the step where people leave. Sign-in belongs
 * at checkout, which still requires it, not at the point where somebody is still
 * deciding.
 *
 * What holds the line instead, in order of how much it is worth:
 *
 *   1. A PHOTO NO ORDER OR DRAFT CLAIMS IS DELETED AFTER THIRTY DAYS (see
 *      `photo-upload.service`). An abandoned upload is the normal case — people
 *      change their mind — so this is not only an abuse control.
 *   2. Six megabytes, and the format checked by MAGIC BYTES rather than the
 *      content-type the caller chose.
 *   3. The same-site check above.
 *   4. The budget below.
 *
 * THE BUDGET IS SPENT ONLY ON A REAL FILE, and the order of these lines is the
 * point. It used to be charged before the body was read, so a hundred and
 * twenty-one EMPTY posts — no file, no bytes, no upload — spent the whole
 * shop-wide allowance and turned photo-cake upload off for every anonymous
 * visitor for an hour, at no cost whatever to the attacker.
 *
 * It is layered because the key it can trust varies:
 *
 *   - a signed-in customer is keyed by account, the one key that cannot be
 *     rotated by opening a new tab;
 *   - otherwise by IP, but ONLY where the deployment says the forwarded header
 *     is trustworthy — `clientIpFrom` answers "" everywhere else, because an
 *     address the caller wrote is not evidence;
 *   - and with no trustworthy address, a SHOP-WIDE budget. It is the weak one
 *     and it is named accordingly: an attacker who gets past the same-site check
 *     can still spend it. `TRUST_PROXY_HEADERS=true` is worth setting on a
 *     deployment behind a proxy it controls, which on Vercel it is.
 *
 * And none of these bound STORAGE on their own: `rateLimit` is a per-process
 * Map, so on a serverless host the real ceiling is per instance and resets on
 * every cold start. The thirty-day sweep is what actually keeps the bill finite.
 */
export const photoUploadController = withErrorHandler(async (request: Request) => {
  if (isCrossSite(request)) {
    throw new AppError("Photo uploads are only accepted from this shop.", 403);
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File)) {
    throw new ValidationError(
      [{ field: "photo", message: "No photo was received" }],
      "No photo was received",
    );
  }

  const customer = await getCustomerSession();
  const ip = clientIpFrom(request.headers);

  if (customer) {
    rateLimit(`photo-upload:customer:${customer.sub}`, { limit: 20, windowMs: HOUR });
  } else if (ip) {
    rateLimit(`photo-upload:ip:${ip}`, { limit: 10, windowMs: HOUR });
  } else {
    // Thirty, not a hundred and twenty. This is one bucket for every anonymous
    // visitor at once, and the retention it feeds is now thirty days — so the
    // number has to be one a real shop's photo-cake traffic stays under while
    // being small enough that spending it does not fill the media plan.
    rateLimit("photo-upload:anonymous", { limit: 30, windowMs: HOUR });
  }

  const uploaded = await uploadPhotoCakeImage(file);

  return ok(uploaded, "Photo uploaded");
});
