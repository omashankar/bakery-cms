import { ok } from "@/lib/server/http/response";
import { withErrorHandler, AppError } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { getMaintenanceState } from "@/features/settings/server/maintenance.server";

import { priceCart, UnknownProductError } from "./pricing.server";
import { createDraft } from "./draft.repository";
import { quoteSchema } from "./checkout.validators";

/**
 * Prices a cart and holds the result as a draft.
 *
 * Anonymous, like the rest of checkout — it discloses nothing a visitor cannot
 * already read off the product pages, and it is the step that takes the pricing
 * decision away from the browser.
 *
 * The draft id it returns is what the payment is opened against, so the amount
 * the customer is charged is a number the shop computed and stored BEFORE the
 * gateway was involved.
 */
export const quoteCartController = withErrorHandler(async (request: Request) => {
  const maintenance = await getMaintenanceState();
  if (maintenance.isClosed) {
    const message =
      maintenance.message || "The store is closed for maintenance. Please try again shortly.";
    throw new AppError(message, 503, [{ field: "maintenance", message }]);
  }

  const input = validate(quoteSchema, await readJson(request));

  try {
    const quote = await priceCart(input);
    const draft = await createDraft(quote, {
      giftWrap: Boolean(input.giftWrap),
      deliveryAddress: input.deliveryAddress,
      address: input.address,
      deliverySlot: input.deliverySlot,
      orderNotes: input.orderNotes,
    });

    return ok(
      {
        draftId: draft.id,
        items: quote.items,
        totals: quote.totals,
        coupon: quote.coupon,
        // Reported rather than silently dropped: a code the shop does not
        // honour has to say so, or the customer sees a total that does not
        // match the discount they think they applied.
        rejectedCoupon: quote.rejectedCoupon,
      },
      "Cart priced",
    );
  } catch (error) {
    if (error instanceof UnknownProductError) {
      throw new AppError("One of the items is no longer available.", 409, [
        { field: "items", message: `Unknown product: ${error.slug}` },
      ]);
    }
    throw error;
  }
});
