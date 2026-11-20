import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/question_draft.dart';
import '../repositories/product_questions_repository.dart';

class AskProductQuestion implements UseCase<Unit, QuestionDraft> {
  const AskProductQuestion(this._repository);

  final ProductQuestionsRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(QuestionDraft params) => _repository.ask(params);
}
