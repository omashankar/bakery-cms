import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/product.dart';
import '../../domain/entities/stock_status.dart';
import 'description_block_model.dart';
import 'product_weight_model.dart';
import 'variant_group_model.dart';

part 'product_model.g.dart';

/// One product from `GET /api/products` (`{ products: [...] }`).
@JsonSerializable(createToJson: false)
class ProductModel {
  const ProductModel({
    required this.id,
    required this.name,
    required this.slug,
    required this.description,
    required this.price,
    required this.images,
    required this.categoryId,
    required this.categoryIds,
    required this.occasionIds,
    required this.deliveryTierIds,
    required this.weights,
    required this.shapes,
    required this.flavourOptions,
    required this.variantGroups,
    required this.descriptionBlocks,
    required this.status,
    required this.stockStatus,
    required this.isFeatured,
    required this.isBestSeller,
    required this.isTrending,
    required this.allowsMessage,
    required this.allowsPhotoUpload,
    required this.codAllowed,
    required this.rating,
    required this.reviewCount,
    this.compareAtPrice,
    this.weightLabel,
    this.photoFrameShape,
  });

  factory ProductModel.fromJson(Map<String, dynamic> json) => _$ProductModelFromJson(json);

  static const String published = 'published';

  @JsonKey(fromJson: JsonReaders.string)
  final String id;
  @JsonKey(fromJson: JsonReaders.string)
  final String name;
  @JsonKey(fromJson: JsonReaders.string)
  final String slug;
  @JsonKey(fromJson: JsonReaders.string)
  final String description;
  @JsonKey(fromJson: JsonReaders.toDouble)
  final double price;
  @JsonKey(fromJson: JsonReaders.toDoubleOrNull)
  final double? compareAtPrice;
  @JsonKey(fromJson: JsonReaders.strings)
  final List<String> images;

  /// The legacy single category, folded into [categoryIds] below.
  @JsonKey(fromJson: JsonReaders.string)
  final String categoryId;
  @JsonKey(fromJson: JsonReaders.strings)
  final List<String> categoryIds;
  @JsonKey(fromJson: JsonReaders.strings)
  final List<String> occasionIds;
  @JsonKey(fromJson: JsonReaders.strings)
  final List<String> deliveryTierIds;
  @JsonKey(defaultValue: <ProductWeightModel>[])
  final List<ProductWeightModel> weights;
  final String? weightLabel;
  @JsonKey(fromJson: JsonReaders.strings)
  final List<String> shapes;
  @JsonKey(fromJson: JsonReaders.strings)
  final List<String> flavourOptions;
  @JsonKey(defaultValue: <VariantGroupModel>[])
  final List<VariantGroupModel> variantGroups;
  @JsonKey(defaultValue: <DescriptionBlockModel>[])
  final List<DescriptionBlockModel> descriptionBlocks;
  @JsonKey(fromJson: JsonReaders.string)
  final String status;
  @JsonKey(fromJson: JsonReaders.string)
  final String stockStatus;
  @JsonKey(fromJson: JsonReaders.boolOr)
  final bool isFeatured;
  @JsonKey(fromJson: JsonReaders.boolOr)
  final bool isBestSeller;
  @JsonKey(fromJson: JsonReaders.boolOr)
  final bool isTrending;

  /// Takes a message unless the product says otherwise: the website draws the
  /// box for `cake.allowsMessage !== false`, so an older product with no
  /// flag offers it.
  @JsonKey(fromJson: JsonReaders.boolTrue)
  final bool allowsMessage;
  @JsonKey(fromJson: JsonReaders.boolOr)
  final bool allowsPhotoUpload;

  /// `circle`, `square`, `heart`, `portrait`, `landscape` or `wrap`.
  final String? photoFrameShape;

  /// Cash on delivery is allowed unless the product says otherwise.
  @JsonKey(fromJson: JsonReaders.boolTrue)
  final bool codAllowed;
  @JsonKey(fromJson: JsonReaders.toDouble)
  final double rating;
  @JsonKey(fromJson: JsonReaders.toInt)
  final int reviewCount;

  bool get isPublished => status.isEmpty || status == published;

  Product toEntity() => Product(
    id: id,
    name: name,
    slug: slug,
    description: description,
    price: price,
    compareAtPrice: compareAtPrice != null && compareAtPrice! > price ? compareAtPrice : null,
    images: images.where((url) => url.trim().isNotEmpty).toList(),
    categoryIds: {...categoryIds, if (categoryId.isNotEmpty) categoryId}.toList(),
    occasionIds: occasionIds,
    deliveryTierIds: deliveryTierIds,
    weights: weights.map((w) => w.toEntity()).where((w) => w.label.isNotEmpty).toList(),
    weightLabel: (weightLabel ?? '').trim().isEmpty ? null : weightLabel,
    shapes: shapes,
    flavourOptions: flavourOptions,
    variantGroups: variantGroups
        .map((group) => group.toEntity())
        .where((group) => group.options.isNotEmpty)
        .toList(),
    descriptionBlocks: descriptionBlocks
        .map((block) => block.toEntity())
        .where((block) => block.body.trim().isNotEmpty)
        .toList(),
    stockStatus: StockStatus.fromApi(stockStatus),
    isFeatured: isFeatured,
    isBestSeller: isBestSeller,
    isTrending: isTrending,
    allowsMessage: allowsMessage,
    allowsPhotoUpload: allowsPhotoUpload,
    photoFrameShape: (photoFrameShape ?? '').trim().isEmpty ? null : photoFrameShape!.trim(),
    codAllowed: codAllowed,
    rating: rating,
    reviewCount: reviewCount,
  );
}
