/// Copy for the product page's own blocks: the rating, the price line, the
/// delivery panel, the details and "You may also like". The words it shares
/// with cards and listings (Add to cart, Buy now, Quantity) stay in
/// `CatalogStrings`.
abstract final class ProductPageStrings {
  // Rating: "4.6 ★  Rating & 14 Reviews"
  static const String ratingAnd = 'Rating &';
  static const String review = 'Review';
  static const String reviews = 'Reviews';

  /// After a discount's number on the product page: "34% off".
  static const String percentOffSuffix = '% off';

  /// The shop adds GST on top of the subtotal at checkout, so the price shown
  /// here is never "inclusive of all taxes".
  static const String taxNote = 'Price before GST. GST and delivery are added at checkout.';

  // Delivery panel
  static const String notDeliveredHint =
      'Try another PIN code. The shop confirms delivery at checkout.';

  // Sections
  static const String productDetails = 'Product details';
  static const String youMayAlsoLike = 'You may also like';
}
