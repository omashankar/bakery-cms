import 'package:equatable/equatable.dart';

import 'faq_category.dart';

/// One published question and its answer.
class FaqItem extends Equatable {
  const FaqItem({
    required this.id,
    required this.question,
    required this.answer,
    required this.category,
    required this.sortOrder,
  });

  final String id;
  final String question;
  final String answer;

  /// Null for a category the app does not know.
  final FaqCategory? category;
  final int sortOrder;

  @override
  List<Object?> get props => [id, question, answer, category, sortOrder];
}
