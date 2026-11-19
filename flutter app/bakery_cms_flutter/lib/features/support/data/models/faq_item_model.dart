import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/faq_category.dart';
import '../../domain/entities/faq_item.dart';

part 'faq_item_model.g.dart';

/// One entry of `GET /api/content/faq`. A visitor is sent the published ones
/// only (`getPublicContent`), but [status] is still checked: the website's
/// `selectStorefrontFaqs` filters on it too, and a staff session would be
/// sent the drafts.
@JsonSerializable(createToJson: false)
class FaqItemModel {
  const FaqItemModel({
    required this.id,
    required this.question,
    required this.answer,
    required this.category,
    required this.status,
    required this.sortOrder,
  });

  factory FaqItemModel.fromJson(Map<String, dynamic> json) => _$FaqItemModelFromJson(json);

  static const String publishedStatus = 'published';

  @JsonKey(fromJson: JsonReaders.string)
  final String id;
  @JsonKey(fromJson: JsonReaders.string)
  final String question;
  @JsonKey(fromJson: JsonReaders.string)
  final String answer;
  @JsonKey(fromJson: JsonReaders.string)
  final String category;
  @JsonKey(fromJson: JsonReaders.string)
  final String status;
  @JsonKey(fromJson: JsonReaders.toInt)
  final int sortOrder;

  bool get isPublished => status == publishedStatus;

  FaqItem toEntity() => FaqItem(
    id: id,
    question: question.trim(),
    answer: answer.trim(),
    category: FaqCategory.fromApi(category),
    sortOrder: sortOrder,
  );
}
