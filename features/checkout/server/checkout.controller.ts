import { ok } from "@/lib/server/http/response";
import { withErrorHandler, AppError } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { getMaintenanceState } from "@/features/settings/server/maintenance.server";

import { priceCart, UnknownProductError, UnknownWeightError } from "./pricing.server";
import { createDraft } from "./draft.repository";
import { quoteSchema } from "./checkout.validators";
import { isBeforeLeadTime } from "@/features/orders/lib/delivery-date";
import { checkMinimumOrder } from "@/features/checkout/lib/minimum-order";
import { formatCurrency } from "@/utils/format";

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

  // PRICE the address the order is actually going to.
  //
  // `deliveryAddress` (city + pincode, used to pick the zone) and `address` (the
  // full destination stored on the order) arrived as two independent
  // caller-supplied fields and were never compared. So a caller could be quoted
  // for the cheapest zone and delivered anywhere: `deliveryAddress` of Thane,
  // `address` of Pune, and the draft — which is what Razorpay is charged and
  // what the webhook builds the order from — carried both.
  //
  // When the full address is present it IS the delivery address, so it decides
  // the zone. `deliveryAddress` only stands alone before the customer has
  // entered one, which is the running-total case it exists for.
  const pricingAddress = input.address
    ? { city: input.address.city, pincode: input.address.pincode }
    : input.deliveryAddress;

  try {
    const quote = await priceCart({ ...input, deliveryAddress: pricingAddress });

    // Refuse an impossible delivery date HERE, before any money moves.
    //
    // The same rule is enforced at placement, but placement runs after the
    // gateway has captured — so a refusal there strands a paid customer, and the
    // webhook retries the identical doomed placement until the gateway gives up.
    // The quote is the last moment this costs nothing.
    const leadDays = Number((quote.totals as { deliveryMinDays?: number }).deliveryMinDays);
    if (input.deliverySlot?.date && isBeforeLeadTime(input.deliverySlot.date, leadDays)) {
      throw new AppError(
        `We need ${leadDays} day${leadDays === 1 ? "" : "s"} to prepare an order for this area. Please choose a later delivery date.`,
        409,
        [{ field: "deliverySlot.date", message: "Too soon for this delivery area" }],
      );
    }

    // The shop's minimum, enforced where refusing is free.
    //
    // This lived only in the browser — a disabled button and a toast — so the
    // quote priced a below-minimum cart, handed back a draft, and the Razorpay
    // order was opened on it. The refusal, if it came at all, came after the
    // card was captured. Same lesson as the delivery lead time above: the quote
    // is the last moment a refusal costs nobody anything.
    const minimum = checkMinimumOrder(quote.totals.subtotal, quote.commerce.minOrderValue);
    if (minimum.below) {
      throw new AppError(
        `This shop's minimum order is ${formatCurrency(quote.commerce.minOrderValue, quote.currency)}. Please add ${formatCurrency(minimum.shortfall, quote.currency)} more to continue.`,
        409,
        [{ field: "items", message: "Order is below the shop's minimum" }],
      );
    }

    const draft = await createDraft(quote, {
      giftWrap: Boolean(input.giftWrap),
      deliveryAddress: pricingAddress,
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
    // Same class of disagreement: the cart is asking for a size this shop does
    // not sell. Pricing it at the smallest tier while keeping the requested
    // label is how a 2 kg cake gets sold for the price of a 0.5 kg one.
    if (error instanceof UnknownWeightError) {
      throw new AppError("One of the items is no longer available in that size.", 409, [
        { field: "items", message: `Unknown weight on ${error.slug}: ${error.weight}` },
      ]);
    }
    throw error;
  }
});
