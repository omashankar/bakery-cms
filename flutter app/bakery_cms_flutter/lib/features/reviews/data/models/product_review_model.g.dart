// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'product_review_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProductReviewModel _$ProductReviewModelFromJson(Map<String, dynamic> json) => ProductReviewModel(
  id: JsonReaders.string(json['id']),
  authorName: JsonReaders.string(json['authorName']),
  rating: JsonReaders.toDouble(json['rating']),
  body: JsonReaders.string(json['body']),
  isFeatured: JsonReaders.boolOr(json['isFeatured']),
  helpfulCount: JsonReaders.toInt(json['helpfulCount']),
  unhelpfulCount: JsonReaders.toInt(json['unhelpfulCount']),
  photoUrls: JsonReaders.strings(json['photoUrls']),
  title: json['title'] as String?,
  createdAt: json['createdAt'] as String?,
  adminReply: json['adminReply'] as String?,
  deliveredCity: json['deliveredCity'] as String?,
);
