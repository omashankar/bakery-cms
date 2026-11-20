import 'package:json_annotation/json_annotation.dart';

import '../../domain/entities/catalog.dart';
import '../../domain/entities/group_kind.dart';
import '../../domain/entities/product_group.dart';
import 'product_group_model.dart';

part 'catalog_model.g.dart';

/// `GET /api/catalog` → `data`.
@JsonSerializable(createToJson: false)
class CatalogModel {
  const CatalogModel({
    required this.categories,
    required this.occasions,
    required this.collections,
  });

  factory CatalogModel.fromJson(Map<String, dynamic> json) => _$CatalogModelFromJson(json);

  @JsonKey(defaultValue: <ProductGroupModel>[])
  final List<ProductGroupModel> categories;
  @JsonKey(defaultValue: <ProductGroupModel>[])
  final List<ProductGroupModel> occasions;
  @JsonKey(defaultValue: <ProductGroupModel>[])
  final List<ProductGroupModel> collections;

  Catalog toEntity() => Catalog(
    categories: _active(categories, GroupKind.category),
    occasions: _active(occasions, GroupKind.occasion),
    collections: _active(collections, GroupKind.collection),
  );

  /// The website's `offeredRows` (`features/catalog/lib/catalog-utils.ts`):
  /// switched-off rows dropped; ordered by `sortOrder`, lowest first, a row
  /// with none AFTER every numbered one, ties keeping the stored order; and
  /// one row per slug, the first in that order winning.
  static List<ProductGroup> _active(List<ProductGroupModel> groups, GroupKind kind) {
    final live = groups.where((g) => g.isActive && g.slug.isNotEmpty).toList();
    final ordered = [for (final (index, group) in live.indexed) (index: index, group: group)]
      ..sort((a, b) {
        final left = a.group.sortOrder;
        final right = b.group.sortOrder;
        if (left != right) {
          if (left == null) return 1;
          if (right == null) return -1;
          return left.compareTo(right);
        }
        return a.index.compareTo(b.index);
      });
    final seen = <String>{};
    return [
      for (final entry in ordered)
        if (seen.add(entry.group.slug)) entry.group.toEntity(kind),
    ];
  }
}
