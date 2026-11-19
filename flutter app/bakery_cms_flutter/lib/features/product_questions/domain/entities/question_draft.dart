import 'package:equatable/equatable.dart';

/// A question the customer is about to ask: filed as a product enquiry, the
/// same record the website's form creates (`product-question-form.tsx`).
class QuestionDraft extends Equatable {
  const QuestionDraft({
    required this.productSlug,
    required this.productName,
    required this.name,
    required this.email,
    required this.question,
  });

  final String productSlug;
  final String productName;
  final String name;

  /// Where the shop sends the answer.
  final String email;
  final String question;

  @override
  List<Object?> get props => [productSlug, productName, name, email, question];
}
