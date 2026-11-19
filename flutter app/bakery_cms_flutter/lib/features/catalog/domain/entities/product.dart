import 'package:equatable/equatable.dart';

import 'description_block.dart';
import 'product_modules.dart';
import 'product_weight.dart';
import 'stock_status.dart';
import 'variant_group.dart';

class Product extends Equatable {
  const Product({
    required this.id,
    required this.name,
    required this.slug,
    required this.description,
    required this.price,
    required this.images,
    required this.categoryIds,
    required this.occasionIds,
    required this.weights,
    required this.shapes,
    required this.flavourOptions,
    required this.variantGroups,
    required this.descriptionBlocks,
    required this.stockStatus,
    this.compareAtPrice,
    this.weightLabel,
    this.deliveryTierIds = const [],
    this.isFeatured = false,
    this.isBestSeller = false,
    this.isTrending = false,
    this.allowsMessage = false,
    this.allowsPhotoUpload = false,
    this.photoFrameShape,
    this.codAllowed = true,
    this.rating = 0,
    this.reviewCount = 0,
  });

  final String id;
  final String name;
  final String slug;
  final String description;

  /// The base price. The price of a size is the size's own price.
  final double price;

  /// The product's one "was" price, against the BASE price. What is struck
  /// through beside a size or an option is moved by it: see [displayCompareAt].
  final double? compareAtPrice;

  /// A gallery: `images[1]` is a different photo, not a smaller copy.
  final List<String> images;
  final List<String> categoryIds;
  final List<String> occasionIds;
  final List<ProductWeight> weights;

  /// What the shop calls the size choice ("Weight", "Size", "Pack").
  final String? weightLabel;

  /// Legacy flat list, from before shapes became a variant group. The
  /// website no longer offers it or puts it on a line, so neither does the app.
  final List<String> shapes;

  /// Legacy flat list, from before flavours became a variant group. The
  /// website no longer offers it or puts it on a line, so neither does the app.
  final List<String> flavourOptions;
  final List<VariantGroup> variantGroups;
  final List<DescriptionBlock> descriptionBlocks;
  final StockStatus stockStatus;
  final List<String> deliveryTierIds;
  final bool isFeatured;
  final bool isBestSeller;
  final bool isTrending;

  /// Takes a message to write on the cake.
  final bool allowsMessage;

  /// A photo cake: the product page offers "Add your photo". Optional, as on
  /// the website; the shop never refuses a photo cake without one.
  final bool allowsPhotoUpload;

  /// The outline the photo is printed inside (`circle`, `heart`, …), as the
  /// shop set it. Null is round, as on the website.
  final String? photoFrameShape;
  final bool codAllowed;
  final double rating;
  final int reviewCount;

  String get image => images.isEmpty ? '' : images.first;
  bool get isAvailable => stockStatus != StockStatus.outOfStock;
  bool get hasWeights => weights.isNotEmpty;

  /// The lowest price it can be bought for, for listing cards.
  double get fromPrice =>
      hasWeights ? weights.map((w) => w.price).reduce((a, b) => a < b ? a : b) : price;

  /// The groups a shop with these [modules] actually sells: a Shape group is
  /// gone, from the page and from the price, when Shape is off. The website's
  /// `variantGroupsEnabledBy`, which its server prices through too.
  List<VariantGroup> groupsEnabledBy(ProductModules modules) =>
      modules.shape ? variantGroups : [for (final group in variantGroups) ?_unlessShape(group)];

  static VariantGroup? _unlessShape(VariantGroup group) => group.isShape ? null : group;

  /// What a listing card shows: the first size with each group's default
  /// option. The website's rule (`defaultProductUnitPrice`), so a card reads
  /// the same price in the app and on the site.
  double get cardPrice => cardPriceWith(ProductModules.all);

  /// [cardPrice] for a shop with these [modules] (the website's `toCard`
  /// gates the groups before pricing them).
  double cardPriceWith(ProductModules modules) {
    // A tier priced 0 is a tier with no price on it, not a free product.
    final tier = weights.firstOrNull;
    return unitPriceFor(weight: tier != null && tier.price > 0 ? tier : null, modules: modules);
  }

  /// The card's struck-through "was" price ([displayCompareAt] of [cardPrice]).
  double? get cardCompareAt => displayCompareAt(cardPrice);

  double? cardCompareAtWith(ProductModules modules) => displayCompareAt(cardPriceWith(modules));

  /// One unit at the chosen size with the chosen options, in a shop with
  /// these [modules].
  ///
  /// The website's `calculateProductUnitPrice` over `variantGroupsEnabledBy`:
  /// a group with no choice is charged its default option, a group the shop
  /// has switched off is not charged at all, and the result never goes below
  /// zero. The server's number is the one charged.
  double unitPriceFor({
    ProductWeight? weight,
    Map<String, String> selections = const {},
    ProductModules modules = ProductModules.all,
  }) {
    final base = weight?.price ?? price;
    final extras = groupsEnabledBy(modules).fold<double>(
      0,
      (sum, group) => sum + (group.chargedOption(selections[group.id])?.priceAdjustment ?? 0),
    );
    final total = base + extras;
    return total < 0 ? 0 : total;
  }

  /// The struck-through price beside [displayPrice], or null.
  ///
  /// The website's `displayCompareAtPrice` (`product-pricing.ts`): the shop's
  /// one compare-at is against the base price, so the strike moves by exactly
  /// what the size and the options moved the price — the rupee saving stays
  /// the one the shop stated. A compare-at at or below the base is not a
  /// discount, and nothing is struck.
  double? displayCompareAt(double displayPrice) {
    final compareAt = compareAtPrice;
    if (compareAt == null || compareAt <= price) return null;
    return compareAt + (displayPrice - price);
  }

  @override
  List<Object?> get props => [
    id,
    name,
    slug,
    description,
    price,
    compareAtPrice,
    images,
    categoryIds,
    occasionIds,
    weights,
    weightLabel,
    shapes,
    flavourOptions,
    variantGroups,
    descriptionBlocks,
    stockStatus,
    deliveryTierIds,
    isFeatured,
    isBestSeller,
    isTrending,
    allowsMessage,
    allowsPhotoUpload,
    photoFrameShape,
    codAllowed,
    rating,
    reviewCount,
  ];
}
