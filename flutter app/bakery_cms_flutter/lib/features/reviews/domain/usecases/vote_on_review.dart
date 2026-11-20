import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/review_vote.dart';
import '../repositories/reviews_repository.dart';

/// 👍 or 👎 on a review; answers the server's new count for that thumb.
class VoteOnReview implements UseCase<int, ReviewVote> {
  const VoteOnReview(this._repository);

  final ReviewsRepository _repository;

  @override
  Future<Either<Failure, int>> call(ReviewVote params) => params.helpful
      ? _repository.markHelpful(params.reviewId)
      : _repository.markUnhelpful(params.reviewId);
}
