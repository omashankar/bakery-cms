import { cartLineId } from "@/features/cart/lib/cart";
import * as productRepo from "@/features/products/server/product.repository";
import { getSettings } from "@/features/settings/server/settings.service";
import { getCoupons, getZones } from "@/features/commerce/server/commerce.service";
import { calculateCartTotals, type CartTotals } from "@/features/orders/lib/cart-totals";
import { getProductWeightOptions } from "@/features/products/lib/product-catalog";
import {
  calculateProductUnitPrice,
  formatVariantSummary,
} from "@/features/products/lib/product-pricing";
import {
  getProductVariantGroups,
  variantGroupsEnabledBy,
} from "@/features/products/lib/variant-utils";
import type { ProductVariantGroup } from "@/types/product";
import { resolveCouponDiscount } from "@/features/orders/lib/coupons";
import { defaultModuleSettings } from "@/features/settings/lib/settings-utils";
import type { CommerceSettings, GeneralSettings, ModuleSettings } from "@/types/settings";
import type { LandingProduct } from "@/constants/landing-data";
import type { DeliveryZone } from "@/types/delivery";

/**
 * Prices a cart on the SERVER, from the shop's own records.
 *
 * Everything about the money used to be chosen by the caller.
 * `cartItemSchema.price` and `totalsSchema.total` were stored verbatim, and
 * `POST /api/razorpay/order` took `amount` from the request body — so a
 * 5000-rupee cake could be ordered, and genuinely paid for, at 1 rupee.
 *
 * The pricing functions were always pure and always server-callable; nothing
 * ever called them here. `calculateCartTotals` already accepted a
 * `commerceOverride`, and `calculateProductUnitPrice` takes plain data. What was
 * missing was a caller that reads the PRODUCT and the SETTINGS from Mongo rather
 * than from the browser — which also fixes a quieter bug, that the client priced
 * against whatever commerce settings that browser had last hydrated.
 *
 * The client still sends what it CHOSE — the slug, quantity, weight label and
 * variant selections. It no longer sends what those choices cost.
 */
export interface QuoteLineInput {
  productSlug: string;
  quantity: number;
  /** The weight OPTION's label, as shown to the customer. */
  weight?: string;
  flavour?: string;
  shape?: string;
  message?: string;
  photoUrl?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  variantSelections?: Record<string, string>;
}

export interface QuoteInput {
  items: QuoteLineInput[];
  couponCode?: string;
  giftWrap?: boolean;
  deliveryAddress?: { city?: string; pincode?: string };
}

export interface QuotedLine extends QuoteLineInput {
  /**
   * Stable identity for the line, in the shape the cart uses.
   *
   * `QuoteLineInput` carries no id — the client sends what it CHOSE, not what
   * the shop calls it — so the priced line had none either, and every order
   * placed through checkout was stored with items that could not be told
   * apart. Three screens key their rows on it.
   */
  id: string;
  name: string;
  image: string;
  /** The unit price the SHOP says, for the options chosen. */
  price: number;
  variantSummary?: string[];
}

export interface CartQuote {
  items: QuotedLine[];
  totals: CartTotals;
  coupon: { code: string; discountAmount: number } | null;
  /** Codes the caller sent that the shop does not honour, for reporting back. */
  rejectedCoupon?: string;
  commerce: CommerceSettings;
  /**
   * The shop's currency, from General settings.
   *
   * Carried alongside the money so a server-side caller can format it. Route
   * handlers never render the root layout, so `formatCurrency` has no `<html>`
   * to read the active locale from and silently falls back to rupees.
   */
  currency: string;
}

export class UnknownProductError extends Error {
  constructor(readonly slug: string) {
    super(`No such product: ${slug}`);
    this.name = "UnknownProductError";
  }
}

/**
 * The cart asked for a size this product does not sell.
 *
 * The same situation as an unknown slug — the cart and the shop disagree about
 * what is on offer — and it is refused the same way, rather than priced.
 */
export class UnknownWeightError extends Error {
  constructor(
    readonly slug: string,
    readonly weight: string,
  ) {
    super(`No such weight on ${slug}: ${weight}`);
    this.name = "UnknownWeightError";
  }
}

/**
 * A flat legacy value, matched onto the option that replaced it.
 *
 * `shape` and `flavour` were both string fields on a cart line with their own
 * hard-coded pickers, and both are variant groups now. Two kinds of line still
 * carry the old fields: one built by Reorder from an order placed before the
 * change, and one sitting in a browser’s localStorage cart from before the
 * deploy — carts have no expiry, so those keep arriving.
 *
 * Returns null where there is nothing to map, which is the signal to LEAVE the
 * old value alone: a shape or flavour the group cannot answer for is the
 * customer’s own word, and deleting it bakes the default with no record that
 * somebody asked for something else.
 */
function mapLegacyChoice(
  group: ProductVariantGroup | undefined,
  value: string | undefined,
  carried: Record<string, string>,
): { groupId: string; optionId: string } | null {
  const wanted = typeof value === "string" ? value.trim() : "";
  // A real selection always wins: a line from AFTER the change carries one, and
  // the legacy field must not override it.
  if (!group || !wanted || carried[group.id]) return null;

  const option = group.options.find(
    (candidate) => candidate.label.trim().toLowerCase() === wanted.toLowerCase(),
  );
  return option ? { groupId: group.id, optionId: option.id } : null;
}
/**
 * What one line costs, AND what the customer chose to make it cost that.
 *
 * The two are returned together because they must be derived from the same
 * groups. `QuotedLine.variantSummary` existed and was never assigned —
 * `formatVariantSummary` was not imported here at all — so the field was empty
 * on every order this shop has taken, and the kitchen email read "2 x Black
 * Forest" with no size, flavour or message. The customer was charged for those
 * choices the whole time: `calculateVariantAdjustment` applies every enabled
 * group, falling back to its default option when no selection arrives.
 *
 * Computing the summary anywhere else would let the order narrate one set of
 * options and bill another — a group added, gated, or defaulted differently on
 * the two paths. One list, used twice.
 */
function priceLine(
  product: LandingProduct,
  line: QuoteLineInput,
  /** The modules this shop has switched on. A group it does not sell is not priced. */
  modules: ModuleSettings,
): {
  price: number;
  variantSummary: string[];
  /** Present so the ORDER records the choice, not only the display text. */
  variantSelections: Record<string, string>;
  /** The shop's word for the size axis, so every later surface can head it. */
  weightLabel?: string;
  /** Cleared, and only where a legacy value was mapped onto a real option. */
  shape?: undefined;
  flavour?: undefined;
} {
  const weightOptions = getProductWeightOptions(product);

  // An unrecognised weight label is REFUSED, not repriced.
  //
  // This was `Math.max(0, findIndex(...))`, so a label the product does not
  // have priced at index 0 — the smallest, cheapest tier — while the line kept
  // the label the customer sent. The order then read "2 kg" and charged for
  // 0.5 kg, and the bakery baked and delivered the 2 kg cake. The comment here
  // said this stopped a stale cart buying the largest cake at the smallest
  // price; it was the mechanism for doing exactly that.
  //
  // No label at all is different, and still fine: the customer did not choose a
  // size, so the default tier applies.
  let index = 0;
  if (line.weight) {
    index = weightOptions.findIndex((option) => option.label === line.weight);
    if (index < 0) throw new UnknownWeightError(product.slug, line.weight);
  }

  const chosen = weightOptions[index] ?? weightOptions[0];
  const weightPrice = product.weights?.[index]?.price ?? product.price + (chosen?.modifier ?? 0);

  // Only the groups this shop sells. A module that is off used to hide the
  // picker and keep charging its default option's surcharge — and since the
  // adjustment falls back to that default whenever no selection is sent,
  // omitting the selection would not have stopped it either.
  const variantGroups = variantGroupsEnabledBy(getProductVariantGroups(product), modules);
  const shapeGroup = variantGroups.find((group) => group.type === "shape");
  /**
   * The same treatment for the legacy flat `flavour`.
   *
   * `flavourOptions` was a second, unpriced option system with its own
   * hard-coded picker; it is a variant group now. A line built by Reorder from
   * an older order, or sitting in a browser from before the change, still
   * carries the flat field — and without this it would be printed beside a
   * recomputed “Flavour: <default>”, which is the doubling shape already had.
   *
   * Matched by NAME rather than by a type, because flavour has no dedicated
   * variant type: a shop names the group itself, and calling it anything else
   * simply means the old value is preserved rather than mapped.
   */
  const flavourGroup = variantGroups.find(
    (group) => group.name.trim().toLowerCase() === "flavour",
  );
  /**
   * A line that still carries the OLD flat `shape` string.
   *
   * Shapes used to be `shapes: string[]` and a `shape` field on the line; they
   * are a variant group now. Two kinds of line still hold the old field: one
   * built by Reorder from an order placed before the change, and one sitting in
   * a customer’s localStorage cart from before the deploy — carts have no
   * expiry, so those arrive for as long as the browser keeps them.
   *
   * Without this the line said the shape TWICE and could say two different
   * things: `...line` kept “Heart” while `formatVariantSummary` fell back to the
   * group’s default and added “Shape: Round”. `cartLineChoices` concatenates
   * both, so the customer’s confirmation, the invoice and the kitchen email all
   * read “Heart · Shape: Round” — and the kitchen copy is the one acted on.
   *
   * The old choice is MAPPED rather than dropped. Dropping it would silently
   * turn a reordered Heart into whatever the group defaults to, which is the
   * same damage in the other direction.
   */
  const carried = line.variantSelections ?? {};
  const mappedShape = mapLegacyChoice(shapeGroup, line.shape, carried);
  const mappedFlavour = mapLegacyChoice(flavourGroup, line.flavour, carried);
  const variantSelections = {
    ...carried,
    ...(mappedShape ? { [mappedShape.groupId]: mappedShape.optionId } : {}),
    ...(mappedFlavour ? { [mappedFlavour.groupId]: mappedFlavour.optionId } : {}),
  };

  return {
    /**
     * Cleared only where the old value was actually MAPPED onto an option.
     *
     * Gated on `shapeGroup` alone, this destroyed a legacy shape the group
     * cannot match — one the shop has since renamed or removed — leaving the
     * line asserting the group's default with no record of what the customer
     * actually asked for. Before the fix the invoice at least still read
     * "Rectangle · Shape: Round", which is contradictory but not silent.
     */
    ...(mappedShape ? { shape: undefined } : {}),
    ...(mappedFlavour ? { flavour: undefined } : {}),
    /**
     * Taken from the PRODUCT, never from the line.
     *
     * The client sends what it chose; what that choice is CALLED is the
     * shop's to say, and a line that sat in a browser since before the shop
     * renamed the axis would otherwise keep printing the old word on a new
     * invoice.
     */
    ...(product.weightLabel?.trim() ? { weightLabel: product.weightLabel.trim() } : {}),
    price: calculateProductUnitPrice({
      basePrice: product.price,
      weightPrice,
      variantGroups,
      variantSelections,
    }),
    /**
     * RETURNED, not merely used to price.
     *
     * The mapping above wrote into a local and this returned only `price` and
     * `variantSummary`, so the stored line kept neither the flat `shape` nor a
     * selection for the group — the customer's choice survived as display text
     * and nothing else. A reorder then showed "Shape: Heart" from the copied
     * summary while the re-quote recorded and cooked "Shape: Round", and with
     * every migrated option priced at 0 nothing moved to warn anybody.
     *
     * It also let two lines collapse: with no selection and no shape,
     * `cartLineId`'s variant key is the literal "default" for both a Heart and
     * a Round of the same cake, so `addToCart` merged them and added the
     * quantities — the exact bug `cartLineId`'s own comment records.
     */
    variantSelections,
    // The same list the price came from, resolved the same way — including the
    // fallback to a group's default, so a line never states a price it does not
    // explain, and never mentions a group the shop has switched off.
    variantSummary: formatVariantSummary(variantGroups, variantSelections),
  };
}

export async function priceCart(input: QuoteInput): Promise<CartQuote> {
  const [settingsRaw, coupons, zones] = await Promise.all([
    getSettings(),
    Promise.resolve(getCoupons()),
    Promise.resolve(getZones()),
  ]);

  const settings = settingsRaw as unknown as Record<string, unknown>;
  const commerce = (settings.commerce ?? {}) as CommerceSettings;
  const currency = ((settings.general ?? {}) as GeneralSettings).currency;
  // Defaults are every module ON, so a settings document written before these
  // switches existed prices exactly as it did before.
  const modules: ModuleSettings = {
    ...defaultModuleSettings,
    ...((settings.modules ?? {}) as Partial<ModuleSettings>),
  };

  const items: QuotedLine[] = [];
  for (const line of input.items) {
    const quantity = Math.max(1, Math.floor(line.quantity));
    /**
     * Read as what it IS, not as what the pricing helpers want.
     *
     * This was cast straight to `LandingProduct`, which the repository does not
     * return — that is the STOREFRONT's view of a product, built by
     * `toLandingProduct`, and the difference is not academic: a `Product` holds
     * `images: string[]` while a `LandingProduct` exposes `image: string`. So
     * `product.image` below was `undefined` on every order this shop has ever
     * priced, the cast made TypeScript agree, and every order item was stored
     * with no picture.
     */
    const product = await productRepo.findBySlug(line.productSlug);
    // Refused rather than priced at zero: an unknown slug means the cart and the
    // catalogue disagree, and guessing which is right is how a shop gives away
    // a cake it has deleted.
    if (!product) throw new UnknownProductError(line.productSlug);

    items.push({
      ...line,
      id: cartLineId(line),
      quantity,
      name: product.name,
      // The gallery's first picture, which is what the storefront calls the
      // product's image. Never undefined: an item without this field is what
      // made the admin order page crash on `src.trim()`.
      image: product.images?.[0] ?? "",
      // The two shapes DO agree on everything the pricing reads — price,
      // weights, variant groups — so this cast is narrow and deliberate, unlike
      // the one above it replaced.
      ...priceLine(product as unknown as LandingProduct, line, modules),
    });
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // The coupon is RESOLVED here, not accepted. It used to arrive as
  // `z.record(z.string(), z.unknown())` — an object the caller invented, whose
  // discount bore no relation to anything, and which then appeared in the
  // admin's coupon performance report as if it were real.
  const applied = input.couponCode
    ? resolveCouponDiscount(await Promise.resolve(coupons), input.couponCode, subtotal)
    : null;

  const totals = calculateCartTotals({
    items: items as never,
    discount: applied?.discountAmount ?? 0,
    giftWrap: Boolean(input.giftWrap),
    deliveryAddress: input.deliveryAddress,
    commerceOverride: commerce,
    zonesOverride: (await Promise.resolve(zones)) as DeliveryZone[],
    // Tax rounds to the shop's minor unit. On the server there is no `<html>`
    // for the formatter to read a locale from, so this has to be passed.
    currencyOverride: currency,
  });

  return {
    items,
    totals,
    coupon: applied,
    rejectedCoupon: input.couponCode && !applied ? input.couponCode : undefined,
    commerce,
    currency,
  };
}
