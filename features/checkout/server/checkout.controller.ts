import { rateLimit } from "@/lib/server/http/rate-limit";
import { requestContext } from "@/lib/server/audit/audit-log";
import { ok } from "@/lib/server/http/response";
import { withErrorHandler, AppError } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { getMaintenanceState } from "@/features/settings/server/maintenance.server";

import {
  priceCart,
  UndeliverableAtSpeedError,
  OutsideDeliveryZonesError,
  AddressPincodeMismatchError,
  DeliveryPinError,
  UnknownProductError,
  UnknownWeightError,
} from "./pricing.server";
import { createDraft } from "./draft.repository";
import { deliveryPinCheckSchema, pincodeCheckSchema, quoteSchema } from "./checkout.validators";
import { getZones } from "@/features/commerce/server/commerce.service";
import { verifyDeliveryPin } from "@/features/commerce/server/delivery-pin-check.server";
import { answerPincode } from "@/features/commerce/server/pincode-answer.server";
import { AddressSearchUnavailableError, searchAddresses } from "@/features/commerce/server/osm-search.server";
import { isValidLatLng } from "@/features/commerce/lib/delivery-area";
import type { CommerceSettings } from "@/types/settings";
import type { DeliveryZone } from "@/types/delivery";
import {
  isBeforeLeadTime,
  isOfferedTimeSlot,
  isPastSameDayCutoff,
  isPastTimeSlot,
  offeredWindows,
  shopClockNow,
} from "@/features/orders/lib/delivery-date";
import { getSettings } from "@/features/settings/server/settings.service";

/** Now, as the shop's wall clock reads it (General → Timezone). */
async function shopNow(): Promise<Date> {
  const settings = (await getSettings().catch(() => null)) as { general?: { timezone?: string } } | null;
  return shopClockNow(settings?.general?.timezone || "Asia/Kolkata");
}
import { checkMinimumOrder } from "@/features/checkout/lib/minimum-order";
import { formatCurrency } from "@/utils/format";
import { OUTSIDE_ZONES_MESSAGE } from "@/features/commerce/lib/delivery-zone-utils";

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

  /**
   * A quote reserves nothing, so this is not about stock — it is about cost.
   *
   * Every call reads the settings, the coupons, the delivery zones and one
   * product document PER LINE, then prices them. A loop against this endpoint is
   * a database bill and a slow shop for everyone else, from an unauthenticated
   * caller, for free.
   *
   * IP only: a quote carries no identity worth keying on — the email is
   * optional here and a caller pricing a cart has not committed to anything. So
   * this half sleeps until `TRUST_PROXY_HEADERS=true` behind a real proxy, and
   * the order endpoint, which is where the damage actually is, does not depend
   * on it.
   *
   * Loose on purpose: a customer editing their cart, applying a coupon and
   * changing the delivery city re-quotes several times a minute, and a shared
   * address may hold a whole office.
   */
  const { ip } = requestContext(request);
  if (ip) rateLimit(`quote:ip:${ip}`, { limit: 120, windowMs: 60_000 });

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
    ? {
        city: input.address.city,
        pincode: input.address.pincode,
        state: input.address.state,
        // So the street can be checked against the PIN that prices it.
        addressLine1: input.address.addressLine1,
        addressLine2: input.address.addressLine2,
        // The map pin decides the zone; priceCart checks it before pricing.
        location: input.address.location,
      }
    : input.deliveryAddress;

  try {
    const quote = await priceCart({ ...input, deliveryAddress: pricingAddress });

    // Refuse an impossible delivery WINDOW here, before any money moves.
    //
    // The same rules are enforced at placement, but placement runs after the
    // gateway has captured — so a refusal there strands a paid customer, and the
    // webhook retries the identical doomed placement until the gateway gives up.
    // The quote is the last moment this costs nothing.

    // A slot the shop actually offers. `commerce.deliveryTimeSlots` was read by
    // the admin page that edits it and the storefront dropdown that renders it,
    // and by nothing else — so a slot the bakery had removed was still accepted
    // and printed on the invoice as a delivery it is expected to make.
    if (
      input.deliverySlot?.timeSlot &&
      !isOfferedTimeSlot(
        input.deliverySlot.timeSlot,
        offeredWindows(quote.commerce, input.deliveryTierId ?? input.deliverySlot.tierId),
      )
    ) {
      throw new AppError(
        "That delivery time is not one this shop offers. Please choose another.",
        409,
        [{ field: "deliverySlot.timeSlot", message: "Not an available delivery time" }],
      );
    }

    // The stricter of the zone's lead time and the shop's own. The shop-wide
    // `deliveryLeadDays` was read by the date picker and by nothing on the
    // server — and the zone value only exists when zone pricing is on and a
    // zone matched, so on a default shop this was NaN and `isBeforeLeadTime`
    // waved everything through.
    const leadDays = Math.max(
      Number((quote.totals as { deliveryMinDays?: number }).deliveryMinDays) || 0,
      Number(quote.commerce.deliveryLeadDays) || 0,
    );

    // The SHOP's clock, not the server's. These compared against `new Date()`'s
    // local getters, and the server runs in UTC: a 14:00 same-day cutoff closed
    // at 19:30 IST, and between midnight and 05:30 IST "today" was yesterday,
    // so none of these checks ran at all.
    const now = await shopNow();

    if (input.deliverySlot?.date && isBeforeLeadTime(input.deliverySlot.date, leadDays, now)) {
      throw new AppError(
        `We need ${leadDays} day${leadDays === 1 ? "" : "s"} to prepare an order for this area. Please choose a later delivery date.`,
        409,
        [{ field: "deliverySlot.date", message: "Too soon for this delivery area" }],
      );
    }

    /**
     * And a window that has not already closed.
     *
     * The lead time answers “is this day far enough ahead”; nothing asked
     * whether the window on that day has been and gone. Here rather than only
     * in `placeOrder` because this is where refusing is still free — by the
     * time the gateway has captured, refusing a customer over a slot that
     * expired while they were paying is worse than honouring it.
     */
    if (input.deliverySlot?.date) {
      if (isPastSameDayCutoff(input.deliverySlot.date, quote.commerce.sameDayCutoff ?? "", now)) {
        throw new AppError(
          "We have stopped taking orders for delivery today. Please choose a later date.",
          409,
          [{ field: "deliverySlot.date", message: "Orders for today have closed" }],
        );
      }
      if (isPastTimeSlot(input.deliverySlot.date, input.deliverySlot.timeSlot ?? "", now)) {
        throw new AppError(
          "That delivery window has already passed today. Please choose another.",
          409,
          [{ field: "deliverySlot.timeSlot", message: "That window has passed" }],
        );
      }
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
      personalisation: input.personalisation,
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
    /**
     * A 409 like the two above, and for the same reason: the cart and the
     * shop disagree about what is on offer.
     *
     * NAMED, both sides. "Your order cannot go out at that speed" over a
     * six-line cart is an error nobody can act on — the customer has to know
     * which product to remove or which speed to drop to.
     */
    if (error instanceof UndeliverableAtSpeedError) {
      throw new AppError(
        `${error.productName} cannot be delivered by ${error.tierLabel}.`,
        409,
        [{ field: "deliveryTierId", message: error.message }],
      );
    }
    // About the map pin now, which is what is outside — not the PIN code.
    if (error instanceof OutsideDeliveryZonesError) {
      throw new AppError(OUTSIDE_ZONES_MESSAGE, 409, [{ field: "location", message: OUTSIDE_ZONES_MESSAGE }]);
    }
    if (error instanceof AddressPincodeMismatchError) {
      throw new AppError(error.message, 409, [{ field: "pincode", message: error.message }]);
    }
    if (error instanceof DeliveryPinError) {
      throw new AppError(error.message, error.status, [{ field: error.field, message: error.message }]);
    }
    throw error;
  }
});

/**
 * Checks a map pin against the shop's areas and the typed address, for the
 * checkout to say so as soon as the pin is dropped.
 *
 * Advice only. The answer decides nothing: `priceCart` asks again, from the
 * zones as they are then, before any order is priced — so a forged "eligible"
 * buys nothing, and a zone switched off in between is honoured.
 *
 * Tighter than the quote's limit: every call that lands inside an area can
 * cost the shop a Google lookup.
 */
export const checkDeliveryPinController = withErrorHandler(async (request: Request) => {
  const { ip } = requestContext(request);
  if (ip) rateLimit(`delivery-pin:ip:${ip}`, { limit: 30, windowMs: 60_000 });

  const body = await readJson(request);
  // A PIN alone — the product page, cart and header asking "do you deliver to 324002?".
  const byPincode = body && typeof body === "object" && !("location" in body) ? validate(pincodeCheckSchema, body) : null;
  const [settings, zones] = await Promise.all([getSettings(), getZones()]);
  const commerce = ((settings as unknown as { commerce?: CommerceSettings }).commerce ?? {}) as CommerceSettings;

  // A shop without delivery areas takes every address at its flat fee.
  if (!commerce.useZoneBasedDelivery) return ok({ required: false, status: "eligible", charge: commerce.deliveryFee });

  if (byPincode) {
    const answer = await answerPincode(byPincode.pincode, zones as DeliveryZone[], commerce.deliverOutsideZones !== false);
    if (answer.status !== "eligible") return ok({ required: true, status: answer.status });
    return ok({
      required: true,
      status: "eligible",
      charge: answer.zone ? answer.zone.deliveryCharge : (commerce.zoneFallbackDeliveryFee ?? commerce.deliveryFee),
      minDeliveryDays: answer.zone ? answer.zone.minDeliveryDays : null,
      freeDeliveryThreshold: commerce.freeDeliveryThreshold,
      priceMayVary: answer.priceMayVary,
      // For pricing a cart with no pin yet — one of the PIN's post offices, never a door.
      at: answer.at,
    });
  }

  const input = validate(deliveryPinCheckSchema, body);

  const verdict = await verifyDeliveryPin({
    location: input.location,
    pincode: input.pincode,
    city: input.city,
    state: input.state,
    zones: zones as DeliveryZone[],
    deliverOutsideZones: commerce.deliverOutsideZones !== false,
  });

  if (verdict.status === "eligible") {
    return ok({
      required: true,
      status: verdict.status,
      // The zone by id, never by name: this answer is public, and the name is the owner's own word.
      zoneId: verdict.zone?.id ?? "",
      // What the customer will pay and how soon — the zone's own, or the
      // shop's fallback for a pin outside every zone it still delivers to.
      charge: verdict.zone ? verdict.zone.deliveryCharge : (commerce.zoneFallbackDeliveryFee ?? commerce.deliveryFee),
      minDeliveryDays: verdict.zone ? verdict.zone.minDeliveryDays : null,
      freeDeliveryThreshold: commerce.freeDeliveryThreshold,
      // India Post's PIN at the pin; when a PIN line runs close by, the
      // neighbours the customer may really be in.
      postalCode: verdict.verification.postalCode,
      pincodeSure: verdict.nearby?.sure ?? false,
      otherPincodes: verdict.nearby?.others ?? [],
      city: verdict.city,
      state: verdict.state,
      formattedAddress: verdict.verification.formattedAddress,
      placeName: verdict.placeName,
      cityNote: verdict.cityNote,
    });
  }
  return ok({
    required: true,
    status: verdict.status,
    message: verdict.message,
    field: verdict.field,
    found: verdict.found,
    kmToArea: verdict.kmToArea,
  });
});

/**
 * Address suggestions as the customer types, from OpenStreetMap (free).
 *
 * Through the shop's server so answers are cached and calls limited — the
 * free search service asks for fair use. A suggestion only moves the pin; it
 * proves nothing, and the pin is checked on its own when the order is priced.
 */
export const searchAddressesController = withErrorHandler(async (request: Request) => {
  const { ip } = requestContext(request);
  if (ip) rateLimit(`address-search:ip:${ip}`, { limit: 60, windowMs: 60_000 });
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").slice(0, 120);
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const near = params.has("lat") && isValidLatLng({ lat, lng }) ? { lat, lng } : null;
  // A pressed Search also asks Nominatim, which allows a request a second — so it
  // gets its own, tighter limit than the suggestions typed into the box.
  const full = params.get("full") === "1";
  if (full && ip) rateLimit(`address-search-full:ip:${ip}`, { limit: 10, windowMs: 60_000 });
  try {
    return ok(await searchAddresses(q, near, { full }));
  } catch (error) {
    if (!(error instanceof AddressSearchUnavailableError)) throw error;
    throw new AppError(
      "Address search isn't available right now. Drag the pin, tap the map or use your current location instead.",
      503,
    );
  }
});
