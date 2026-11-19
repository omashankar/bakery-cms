import '../entities/review_votes.dart';
import '../repositories/reviews_repository.dart';

/// The reviews this phone has already voted on.
class GetReviewVotes {
  const GetReviewVotes(this._repository);

  final ReviewsRepository _repository;

  Future<ReviewVotes> call() => _repository.votes();
}
