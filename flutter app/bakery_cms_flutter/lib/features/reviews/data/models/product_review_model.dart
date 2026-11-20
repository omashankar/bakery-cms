import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/product_review.dart';

part 'product_review_model.g.dart';

/// One review from `GET /api/reviews?productSlug=` (`data: [...]`) or the
/// one `POST /api/reviews` created.
@JsonSerializable(createToJson: false)
class ProductReviewModel {
  const ProductReviewModel({
    required this.id,
    required this.authorName,
    required this.rating,
    required this.body,
    required this.isFeatured,
    required this.helpfulCount,
    required this.unhelpfulCount,
    required this.photoUrls,
    this.title,
    this.createdAt,
    this.adminReply,
    this.deliveredCity,
  });

  factory ProductReviewModel.fromJson(Map<String, dynamic> json) =>
      _$ProductReviewModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String id;
  @JsonKey(fromJson: JsonReaders.string)
  final String authorName;
  @JsonKey(fromJson: JsonReaders.toDouble)
  final double rating;
  @JsonKey(fromJson: JsonReaders.string)
  final String body;
  final String? title;
  final String? createdAt;
  final String? adminReply;
  final String? deliveredCity;
  @JsonKey(fromJson: JsonReaders.boolOr)
  final bool isFeatured;
  @JsonKey(fromJson: JsonReaders.toInt)
  final int helpfulCount;
  @JsonKey(fromJson: JsonReaders.toInt)
  final int unhelpfulCount;
  @JsonKey(fromJson: JsonReaders.strings)
  final List<String> photoUrls;

  ProductReview toEntity() => ProductReview(
    id: id,
    author: authorName,
    rating: rating,
    body: body,
    title: _text(title),
    date: createdAt == null ? null : DateTime.tryParse(createdAt!),
    adminReply: _text(adminReply),
    isFeatured: isFeatured,
    helpfulCount: helpfulCount,
    unhelpfulCount: unhelpfulCount,
    deliveredCity: _text(deliveredCity),
    photoUrls: photoUrls.where((url) => url.trim().isNotEmpty).toList(),
  );

  static String? _text(String? value) =>
      value == null || value.trim().isEmpty ? null : value.trim();
}
