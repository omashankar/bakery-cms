import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/product_review.dart';
import '../entities/review_draft.dart';
import '../repositories/reviews_repository.dart';

class SubmitReview implements UseCase<ProductReview, ReviewDraft> {
  const SubmitReview(this._repository);

  final ReviewsRepository _repository;

  @override
  Future<Either<Failure, ProductReview>> call(ReviewDraft params) => _repository.submit(params);
}
