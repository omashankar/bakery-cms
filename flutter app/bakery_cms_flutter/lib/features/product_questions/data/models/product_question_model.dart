import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/product_question.dart';

part 'product_question_model.g.dart';

/// One answered enquiry from `GET /api/inquiries/questions?productSlug=`:
/// the server sends only `id`, `name`, `message`, `answer`, `answeredAt` and
/// `createdAt`.
@JsonSerializable(createToJson: false)
class ProductQuestionModel {
  const ProductQuestionModel({
    required this.id,
    required this.name,
    required this.message,
    required this.answer,
    this.answeredAt,
  });

  factory ProductQuestionModel.fromJson(Map<String, dynamic> json) =>
      _$ProductQuestionModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String id;
  @JsonKey(fromJson: JsonReaders.string)
  final String name;
  @JsonKey(fromJson: JsonReaders.string)
  final String message;
  @JsonKey(fromJson: JsonReaders.string)
  final String answer;
  final String? answeredAt;

  /// Null for a row with no answer: it is not public.
  ProductQuestion? toEntity() {
    if (answer.trim().isEmpty || message.trim().isEmpty) return null;
    return ProductQuestion(
      id: id,
      name: name.trim(),
      question: message.trim(),
      answer: answer.trim(),
      answeredAt: answeredAt == null ? null : DateTime.tryParse(answeredAt!),
    );
  }
}
