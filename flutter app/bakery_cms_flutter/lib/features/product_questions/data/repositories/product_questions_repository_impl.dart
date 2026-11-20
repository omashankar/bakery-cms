import 'package:flutter/foundation.dart';
import 'package:fpdart/fpdart.dart';

import '../../../../core/constants/strings/questions_strings.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/error/guard.dart';
import '../../domain/entities/product_question.dart';
import '../../domain/entities/question_draft.dart';
import '../../domain/repositories/product_questions_repository.dart';
import '../datasources/product_questions_remote_data_source.dart';

class ProductQuestionsRepositoryImpl implements ProductQuestionsRepository {
  const ProductQuestionsRepositoryImpl(this._remote);

  final ProductQuestionsRemoteDataSource _remote;

  /// The enquiry type a product question is filed under.
  static const String productInquiry = 'product';

  @override
  Future<Either<Failure, List<ProductQuestion>>> getAnswered(String productSlug) => guard(
    () async => [for (final model in await _remote.fetchAnswered(productSlug)) ?model.toEntity()],
  );

  @override
  Future<Either<Failure, Unit>> ask(QuestionDraft draft) => guard(() async {
    await _remote.ask(bodyOf(draft));
    return unit;
  });

  /// What the website's `ProductQuestionForm` sends: a PRODUCT enquiry,
  /// trimmed, with its subject naming the product.
  @visibleForTesting
  static Map<String, dynamic> bodyOf(QuestionDraft draft) => {
    'type': productInquiry,
    'name': draft.name.trim(),
    'email': draft.email.trim(),
    'subject': '${QuestionsStrings.subjectPrefix} ${draft.productName}',
    'message': draft.question.trim(),
    'productSlug': draft.productSlug,
  };
}
