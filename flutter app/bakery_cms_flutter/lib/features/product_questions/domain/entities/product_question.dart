import 'package:equatable/equatable.dart';

/// One answered question about a product. A question is public only once
/// the shop has answered it (`listAnsweredForProduct` on the server).
class ProductQuestion extends Equatable {
  const ProductQuestion({
    required this.id,
    required this.name,
    required this.question,
    required this.answer,
    this.answeredAt,
  });

  final String id;

  /// Who asked.
  final String name;
  final String question;
  final String answer;
  final DateTime? answeredAt;

  @override
  List<Object?> get props => [id, name, question, answer, answeredAt];
}
