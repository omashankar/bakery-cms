/// Copy for product cards, the listing page's sort and filter, and the
/// Categories tab.
abstract final class ListingStrings {
  // Product card
  static const String reviewsOpen = '(';
  static const String reviewsClose = ')';

  /// A screen reader's reading of the rating badge: "4.6 stars, 14 reviews".
  static String ratingSemantics(String rating, int reviews) =>
      '$rating stars, $reviews ${reviews == 1 ? 'review' : 'reviews'}';

  // Listing header
  static String productCount(int count) => '$count ${count == 1 ? 'product' : 'products'}';

  // Bottom bar
  static const String sortBy = 'Sort by';
  static const String barSeparator = ' · ';
  static const String filter = 'Filter';

  /// "Filter", or "Filter (2)" with two choices ticked.
  static String filterCount(int count) => count == 0 ? filter : '$filter ($count)';

  // Sort sheet
  static const String sortTitle = 'Sort by';
  static const String sortPopularity = 'Popularity';
  static const String sortPriceLowToHigh = 'Price: low to high';
  static const String sortPriceHighToLow = 'Price: high to low';

  // Filter sheet
  static const String filterTitle = 'Filter';
  static const String priceHeading = 'Price';
  static const String availabilityHeading = 'Availability';
  static const String ratingHeading = 'Rating';
  static const String under = 'Under';
  static const String above = 'Above';
  static const String rangeSeparator = ' – ';
  static const String inStockOnly = 'In stock only';
  static const String fourStarAndAbove = '4★ & above';
  static const String apply = 'Apply';
  static const String clear = 'Clear';

  // Nothing left after filtering
  static const String noMatchesTitle = 'No products match';
  static const String noMatchesMessage = 'Try removing a filter to see more.';
  static const String clearFilters = 'Clear filters';

  // Categories tab
  static const String categoriesHeading = 'CATEGORIES';
  static const String occasionsHeading = 'OCCASIONS';
  static const String collectionsHeading = 'COLLECTIONS';
}
