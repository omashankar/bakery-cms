import 'package:equatable/equatable.dart';

import 'catalog.dart';
import 'product.dart';
import 'product_group.dart';
import 'product_rail.dart';

class HomeFeed extends Equatable {
  const HomeFeed({
    this.categories = const [],
    this.occasions = const [],
    this.rails = const [],
    this.allProducts = const [],
    this.catalog = const Catalog(),
  });

  final List<ProductGroup> categories;
  final List<ProductGroup> occasions;
  final List<ProductRail> rails;
  final List<Product> allProducts;

  /// Every group, for the home layout to find the ones it names.
  final Catalog catalog;

  bool get isEmpty => allProducts.isEmpty && categories.isEmpty;

  @override
  List<Object?> get props => [categories, occasions, rails, allProducts, catalog];
}
