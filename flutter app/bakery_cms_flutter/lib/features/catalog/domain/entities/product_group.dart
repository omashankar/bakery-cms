import 'package:equatable/equatable.dart';

import 'group_kind.dart';

/// A category, occasion or collection.
class ProductGroup extends Equatable {
  const ProductGroup({
    required this.id,
    required this.name,
    required this.slug,
    required this.kind,
    this.image = '',
    this.headline = '',
    this.description = '',
    this.productIds = const [],
  });

  final String id;
  final String name;
  final String slug;
  final GroupKind kind;
  final String image;
  final String headline;
  final String description;

  /// A collection lists its products by hand, in order. Categories and
  /// occasions are found from the product's own ids instead.
  final List<String> productIds;

  @override
  List<Object?> get props => [id, name, slug, kind, image, headline, description, productIds];
}
