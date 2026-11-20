import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../entities/product_review.dart';
import '../entities/review_draft.dart';
import '../entities/review_votes.dart';

abstract interface class ReviewsRepository {
  /// The approved reviews of one product, featured first, then newest
  /// (`GET /api/reviews?productSlug=`; the server sorts).
  Future<Either<Failure, List<ProductReview>>> getApproved(String productSlug);

  /// Sends a review. The server forces it to "pending", so it appears only
  /// once the shop approves it.
  Future<Either<Failure, ProductReview>> submit(ReviewDraft draft);

  /// Says a review helped (or did not), and answers the server's new count.
  /// The vote is remembered on this phone whatever the request does.
  Future<Either<Failure, int>> markHelpful(String reviewId);
  Future<Either<Failure, int>> markUnhelpful(String reviewId);

  /// The reviews this phone has voted on.
  Future<ReviewVotes> votes();
}
