import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/product_question.dart';
import '../repositories/product_questions_repository.dart';

/// The product's slug in, its answered questions out.
class GetProductQuestions implements UseCase<List<ProductQuestion>, String> {
  const GetProductQuestions(this._repository);

  final ProductQuestionsRepository _repository;

  @override
  Future<Either<Failure, List<ProductQuestion>>> call(String params) =>
      _repository.getAnswered(params);
}
