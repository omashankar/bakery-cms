import 'package:equatable/equatable.dart';

import 'product.dart';
import 'product_group.dart';

/// One category, occasion or collection with the products in it.
class GroupListing extends Equatable {
  const GroupListing({required this.group, required this.products});

  final ProductGroup group;
  final List<Product> products;

  @override
  List<Object?> get props => [group, products];
}
