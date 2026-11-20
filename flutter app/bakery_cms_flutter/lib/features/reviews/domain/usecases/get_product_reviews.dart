import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/product_review.dart';
import '../repositories/reviews_repository.dart';

/// The product's slug in, its approved reviews out.
class GetProductReviews implements UseCase<List<ProductReview>, String> {
  const GetProductReviews(this._repository);

  final ReviewsRepository _repository;

  @override
  Future<Either<Failure, List<ProductReview>>> call(String params) =>
      _repository.getApproved(params);
}
