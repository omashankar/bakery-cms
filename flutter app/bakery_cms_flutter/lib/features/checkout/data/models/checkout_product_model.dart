import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../../orders/domain/entities/cancellation_class.dart';
import '../../domain/entities/checkout_catalog_entry.dart';

part 'checkout_product_model.g.dart';

/// One product from `GET /api/products`, only the fields checkout reads.
///
/// The website's checkout route projects the same few
/// (`app/(storefront)/store/checkout/page.tsx`): the rest of a product is
/// 120 KB nobody at checkout needs.
@JsonSerializable(createToJson: false)
class CheckoutProductModel {
  const CheckoutProductModel({
    required this.slug,
    required this.status,
    required this.occasionIds,
    this.categoryId = '',
    this.categoryIds = const [],
    this.codAllowed,
    this.cancellationClass,
  });

  factory CheckoutProductModel.fromJson(Map<String, dynamic> json) =>
      _$CheckoutProductModelFromJson(json);

  static const String published = 'published';

  @JsonKey(fromJson: JsonReaders.string)
  final String slug;
  @JsonKey(fromJson: JsonReaders.string)
  final String status;
  @JsonKey(fromJson: JsonReaders.strings)
  final List<String> occasionIds;

  /// The legacy single category, folded into [categoryIds] as the catalogue's
  /// own product model folds it (the shop keeps it as `categoryIds[0]`).
  @JsonKey(fromJson: JsonReaders.string)
  final String categoryId;

  /// Every category the product is filed under: what a scoped coupon reads.
  @JsonKey(fromJson: JsonReaders.strings)
  final List<String> categoryIds;
  @JsonKey(fromJson: _bool)
  final bool? codAllowed;
  @JsonKey(fromJson: _text)
  final String? cancellationClass;

  /// What the storefront sells: the website lists `status === "published"`.
  bool get isPublished => status.isEmpty || status == published;

  static bool? _bool(Object? value) => value is bool ? value : null;

  static String? _text(Object? value) => value is String ? value : null;

  /// [occasionNames] maps the catalogue's occasion ids to their names, as the
  /// website's product mapper resolves them.
  CheckoutCatalogEntry toEntity(Map<String, String> occasionNames) => CheckoutCatalogEntry(
    slug: slug,
    // `productAllowsCod`: absent means allowed.
    codAllowed: codAllowed != false,
    cancellationClass: CancellationClass.fromApi(cancellationClass),
    categoryIds: {...categoryIds, if (categoryId.isNotEmpty) categoryId}.toList(),
    occasions: [
      for (final id in occasionIds)
        if (occasionNames[id] case final name?) name,
    ],
  );
}
