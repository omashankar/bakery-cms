import 'package:equatable/equatable.dart';

import 'product.dart';
import 'product_group.dart';
import 'rail_kind.dart';

/// A horizontal row of products on the home screen.
class ProductRail extends Equatable {
  const ProductRail({required this.kind, required this.products, this.group});

  final RailKind kind;
  final List<Product> products;

  /// The collection behind a [RailKind.collection] rail: its name is the
  /// title and it backs "View all".
  final ProductGroup? group;

  @override
  List<Object?> get props => [kind, products, group];
}
