import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../entities/product_question.dart';
import '../entities/question_draft.dart';

abstract interface class ProductQuestionsRepository {
  /// The answered questions on one product, newest answer first
  /// (`GET /api/inquiries/questions?productSlug=`).
  Future<Either<Failure, List<ProductQuestion>>> getAnswered(String productSlug);

  /// Files the question with the shop (`POST /api/inquiries`). Nothing is
  /// public until the shop answers it.
  Future<Either<Failure, Unit>> ask(QuestionDraft draft);
}
