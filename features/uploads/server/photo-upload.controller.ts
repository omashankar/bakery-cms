import { requireCustomer } from "@/lib/server/auth/customer-dal";
import { ValidationError, withErrorHandler } from "@/lib/server/http/errors";
import { rateLimit } from "@/lib/server/http/rate-limit";
import { ok } from "@/lib/server/http/response";

import { uploadPhotoCakeImage } from "./photo-upload.service";

/**
 * A customer's photo, for a photo cake.
 *
 * SIGNED IN, deliberately. This is the only upload a member of the public can
 * reach, and an anonymous one would be a place to park arbitrary files on the
 * shop's media host at the shop's expense. Requiring an account costs the
 * customer nothing they were not about to do anyway — checkout already requires
 * one — and it puts a name against every upload.
 *
 * Budgeted per account rather than per IP: the account is the thing that cannot
 * be rotated for free, and `requestContext` answers "" for the address behind
 * an untrusted proxy, which would put every customer in one bucket.
 */
export const photoUploadController = withErrorHandler(async (request: Request) => {
  const customer = await requireCustomer();
  rateLimit(`photo-upload:${customer.id}`, { limit: 20, windowMs: 60 * 60 * 1000 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File)) {
    throw new ValidationError([{ field: "photo", message: "No photo was received" }], "No photo was received");
  }

  const uploaded = await uploadPhotoCakeImage(file);

  return ok(uploaded, "Photo uploaded");
});
