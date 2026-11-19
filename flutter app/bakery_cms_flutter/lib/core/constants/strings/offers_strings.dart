/// Copy for the shop's offers, worded as the website words them
/// (`features/commerce/lib/coupon-offers.ts`, `features/orders/lib/coupons.ts`,
/// the product page's "Available offers" and the cart's coupon panel).
abstract final class OffersStrings {
  static const String availableOffers = 'Available offers';
  static const String otherCoupons = 'Other coupons';
  static const String percentOffSuffix = '% OFF';
  static const String flatOffSuffix = ' OFF';
  static const String specialOffer = 'Special Offer';
  static const String useCode = 'Use code';
  static const String onOrdersOver = 'on orders over';
  static const String freeDeliveryOver = 'Free delivery on orders over';
  static const String save = 'Save';
  static const String youWillSave = 'You will save';
  static const String withThisCode = 'with this code';
  static const String add = 'Add';
  static const String moreToUseIt = 'more to use it';
  static const String apply = 'Apply';

  // Refusals (`evaluateCoupon`)
  static const String selectedItemsOnly = 'This code applies to selected items only';
  static const String minimumOrder = 'Minimum order';
  static const String required = 'required';
  static const String cannotApply = 'Coupon cannot be applied to this order';
}
