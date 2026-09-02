import { getCustomerSession } from "@/lib/server/auth/customer-dal";
import { clientIpFrom } from "@/lib/server/http/client-ip";
import { ValidationError, withErrorHandler } from "@/lib/server/http/errors";
import { rateLimit } from "@/lib/server/http/rate-limit";
import { ok } from "@/lib/server/http/response";

import { uploadPhotoCakeImage } from "./photo-upload.service";

const HOUR = 60 * 60 * 1000;

/**
 * A customer's photo, for a photo cake. NO SIGN-IN.
 *
 * This required an account, and the reasoning was sound: it is the only upload a
 * member of the public can reach, and an account is a thing that cannot be
 * rotated for free. What it cost was the sale. A first-time visitor who has
 * chosen a photo cake and pressed Upload was asked for a phone number and an OTP
 * BEFORE they had bought anything — the step where people leave. Sign-in belongs
 * at checkout, which still requires it, not at the point where somebody is still
 * deciding.
 *
 * What holds the line instead, in order of how much it is worth:
 *
 *   1. THE PHOTO IS DELETED IF NO ORDER CLAIMS IT. Tracked on upload, swept a
 *      day later (see `photo-upload.service`). An abandoned upload is the normal
 *      case — people change their mind — so this is not only an abuse control.
 *   2. Six megabytes, and the format checked by MAGIC BYTES rather than the
 *      content-type the caller chose. Both already existed.
 *   3. The budget below.
 *
 * THE BUDGET IS LAYERED, because the key it can trust varies:
 *
 *   - a signed-in customer is keyed by account — the strongest key, and it is
 *     also the one that cannot be rotated by opening a new tab;
 *   - otherwise by IP, but ONLY where the deployment says the forwarded header
 *     is trustworthy. `clientIpFrom` deliberately answers "" everywhere else,
 *     because an address the caller wrote is not evidence;
 *   - and where there is no trustworthy address, a SHOP-WIDE budget. It is
 *     weaker and it is named accordingly: one abuser can spend it and make the
 *     shop's own customers wait an hour. That is the honest trade for not
 *     pretending a client-supplied header identifies anybody — and it is why
 *     `TRUST_PROXY_HEADERS=true` is worth setting on a deployment that sits
 *     behind a proxy it controls, which on Vercel it does.
 */
export const photoUploadController = withErrorHandler(async (request: Request) => {
  const customer = await getCustomerSession();
  const ip = clientIpFrom(request.headers);

  if (customer) {
    rateLimit(`photo-upload:customer:${customer.sub}`, { limit: 20, windowMs: HOUR });
  } else if (ip) {
    rateLimit(`photo-upload:ip:${ip}`, { limit: 10, windowMs: HOUR });
  } else {
    rateLimit("photo-upload:anonymous", { limit: 120, windowMs: HOUR });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File)) {
    throw new ValidationError(
      [{ field: "photo", message: "No photo was received" }],
      "No photo was received",
    );
  }

  const uploaded = await uploadPhotoCakeImage(file);

  return ok(uploaded, "Photo uploaded");
});
