import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/group_kind.dart';
import '../../domain/entities/product_group.dart';

part 'product_group_model.g.dart';

/// A category, occasion or collection from `GET /api/catalog`.
@JsonSerializable(createToJson: false)
class ProductGroupModel {
  const ProductGroupModel({
    required this.id,
    required this.name,
    required this.slug,
    required this.isActive,
    required this.image,
    required this.headline,
    required this.description,
    required this.productIds,
    required this.sortOrder,
  });

  factory ProductGroupModel.fromJson(Map<String, dynamic> json) =>
      _$ProductGroupModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String id;
  @JsonKey(fromJson: JsonReaders.string)
  final String name;
  @JsonKey(fromJson: JsonReaders.string)
  final String slug;
  @JsonKey(fromJson: JsonReaders.boolTrue)
  final bool isActive;
  @JsonKey(fromJson: JsonReaders.string)
  final String image;
  @JsonKey(fromJson: JsonReaders.string)
  final String headline;
  @JsonKey(fromJson: JsonReaders.string)
  final String description;
  @JsonKey(fromJson: JsonReaders.strings)
  final List<String> productIds;

  /// Null when the shop never ordered this row: it then sorts after every
  /// numbered one (the website's `offeredRows`).
  @JsonKey(fromJson: _orderOrNull)
  final int? sortOrder;

  static int? _orderOrNull(Object? value) => value is num ? value.toInt() : null;

  ProductGroup toEntity(GroupKind kind) => ProductGroup(
    id: id,
    name: name,
    slug: slug,
    kind: kind,
    image: image,
    headline: headline,
    description: description,
    productIds: productIds,
  );
}
