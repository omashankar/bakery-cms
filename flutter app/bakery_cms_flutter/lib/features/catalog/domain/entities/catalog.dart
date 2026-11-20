import 'package:equatable/equatable.dart';

import 'group_kind.dart';
import 'product_group.dart';

/// The shop's groupings (`GET /api/catalog`), active ones only.
class Catalog extends Equatable {
  const Catalog({
    this.categories = const [],
    this.occasions = const [],
    this.collections = const [],
  });

  final List<ProductGroup> categories;
  final List<ProductGroup> occasions;
  final List<ProductGroup> collections;

  bool get isEmpty => categories.isEmpty && occasions.isEmpty && collections.isEmpty;

  List<ProductGroup> groupsOf(GroupKind kind) => switch (kind) {
    GroupKind.category => categories,
    GroupKind.occasion => occasions,
    GroupKind.collection => collections,
  };

  ProductGroup? find(GroupKind kind, String slug) {
    for (final group in groupsOf(kind)) {
      if (group.slug == slug) return group;
    }
    return null;
  }

  @override
  List<Object?> get props => [categories, occasions, collections];
}
