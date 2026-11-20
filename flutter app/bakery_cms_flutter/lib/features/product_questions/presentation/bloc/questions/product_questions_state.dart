import 'package:equatable/equatable.dart';

import '../../../../../core/utils/view_status.dart';
import '../../../domain/entities/product_question.dart';

/// The answered questions: initial (not asked yet; below the fold) →
/// loading → success | failure.
class ProductQuestionsState extends Equatable {
  const ProductQuestionsState({
    this.status = ViewStatus.initial,
    this.questions = const [],
    this.errorMessage,
  });

  final ViewStatus status;
  final List<ProductQuestion> questions;
  final String? errorMessage;

  ProductQuestionsState copyWith({
    ViewStatus? status,
    List<ProductQuestion>? questions,
    String? errorMessage,
  }) => ProductQuestionsState(
    status: status ?? this.status,
    questions: questions ?? this.questions,
    errorMessage: errorMessage,
  );

  @override
  List<Object?> get props => [status, questions, errorMessage];
}
