import '../entities/listing_filter.dart';
import '../entities/listing_sort.dart';
import '../entities/product.dart';
import '../entities/product_modules.dart';

/// Sorts and filters a listing the app already holds. Pure and local: a
/// change of sort or filter never waits on the shop.
///
/// Prices are the card's, in a shop with the given modules: the price a
/// card shows, sorts by and is filtered on is one number, as the website's
/// listing sorts and filters `toCard`'s price. A module the shop switched
/// off is not priced, so its surcharge moves no card up or down the list.
/// The modules are required, so no caller can forget them and quietly
/// arrange by a price no card shows.
///
/// Every sort breaks a tie by the listing's own order (the catalogue's, or a
/// collection's hand-picked one), so equal products never swap places
/// between two taps.
abstract final class ListingArranger {
  /// The lowest rating "4★ & above" keeps.
  static const double fourStars = 4;

  static List<Product> arrange(
    List<Product> products, {
    required ProductModules modules,
    ListingSort sort = ListingSort.popularity,
    ListingFilter filter = const ListingFilter(),
  }) {
    final kept = <({int order, Product product})>[
      for (var i = 0; i < products.length; i++)
        if (matches(products[i], filter, modules: modules)) (order: i, product: products[i]),
    ];
    kept.sort((a, b) {
      final byRule = _compare(a.product, b.product, sort, modules);
      return byRule != 0 ? byRule : a.order.compareTo(b.order);
    });
    return [for (final entry in kept) entry.product];
  }

  static bool matches(Product product, ListingFilter filter, {required ProductModules modules}) {
    if (filter.inStockOnly && !product.isAvailable) return false;
    if (filter.fourStarAndAbove && !(product.reviewCount > 0 && product.rating >= fourStars)) {
      return false;
    }
    if (filter.priceBands.isNotEmpty) {
      final price = product.cardPriceWith(modules);
      if (!filter.priceBands.any((band) => band.contains(price))) return false;
    }
    return true;
  }

  /// Whether "4★ & above" means anything here: some product has a review.
  static bool hasRatings(List<Product> products) => products.any((p) => p.reviewCount > 0);

  static int _compare(Product a, Product b, ListingSort sort, ProductModules modules) =>
      switch (sort) {
        ListingSort.popularity => _popularity(a, b),
        ListingSort.priceLowToHigh => a.cardPriceWith(modules).compareTo(b.cardPriceWith(modules)),
        ListingSort.priceHighToLow => b.cardPriceWith(modules).compareTo(a.cardPriceWith(modules)),
      };

  /// Best sellers first, then the most liked (rating × reviews), so one
  /// five-star review does not outrank forty four-star ones.
  static int _popularity(Product a, Product b) {
    if (a.isBestSeller != b.isBestSeller) return a.isBestSeller ? -1 : 1;
    return _score(b).compareTo(_score(a));
  }

  static double _score(Product product) => product.rating * product.reviewCount;
}
