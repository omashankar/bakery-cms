import 'package:equatable/equatable.dart';

import 'price_band.dart';

/// What a customer has narrowed a listing to. Empty by default: everything.
class ListingFilter extends Equatable {
  const ListingFilter({
    this.priceBands = const {},
    this.inStockOnly = false,
    this.fourStarAndAbove = false,
  });

  /// Any of these (a product in one ticked band is kept). None ticked is no
  /// price filter at all.
  final Set<PriceBand> priceBands;
  final bool inStockOnly;

  /// Rated 4 or more by at least one review.
  final bool fourStarAndAbove;

  /// The number on the Filter button: one per ticked choice.
  int get activeCount => priceBands.length + (inStockOnly ? 1 : 0) + (fourStarAndAbove ? 1 : 0);

  bool get isEmpty => activeCount == 0;

  ListingFilter toggleBand(PriceBand band) => copyWith(
    priceBands: priceBands.contains(band) ? ({...priceBands}..remove(band)) : {...priceBands, band},
  );

  ListingFilter copyWith({Set<PriceBand>? priceBands, bool? inStockOnly, bool? fourStarAndAbove}) {
    return ListingFilter(
      priceBands: priceBands ?? this.priceBands,
      inStockOnly: inStockOnly ?? this.inStockOnly,
      fourStarAndAbove: fourStarAndAbove ?? this.fourStarAndAbove,
    );
  }

  @override
  List<Object?> get props => [priceBands, inStockOnly, fourStarAndAbove];
}
