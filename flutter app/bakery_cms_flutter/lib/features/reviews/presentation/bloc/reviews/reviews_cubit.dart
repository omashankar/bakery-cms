import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../core/utils/view_status.dart';
import '../../../domain/entities/product_review.dart';
import '../../../domain/entities/review_vote.dart';
import '../../../domain/entities/review_votes.dart';
import '../../../domain/usecases/get_product_reviews.dart';
import '../../../domain/usecases/get_review_votes.dart';
import '../../../domain/usecases/vote_on_review.dart';
import 'reviews_state.dart';

/// "Ratings and reviews" on a product page, as the website runs it: the
/// approved reviews, and one 👍 or 👎 per review per phone, counted at once
/// and then corrected by the shop's own number.
class ReviewsCubit extends Cubit<ReviewsState> {
  ReviewsCubit(this._getReviews, this._getVotes, this._vote) : super(const ReviewsState());

  final GetProductReviews _getReviews;
  final GetReviewVotes _getVotes;
  final VoteOnReview _vote;

  /// Reads the list. A failed re-read leaves the list on screen alone: a
  /// network blip is not "no reviews".
  Future<void> load(String productSlug) async {
    if (state.status.isLoading) return;
    final hadList = state.status.isSuccess;
    if (!hadList) emit(state.copyWith(status: ViewStatus.loading));
    final votes = await _getVotes();
    final result = await _getReviews(productSlug);
    if (isClosed) return;
    result.match(
      (failure) => emit(
        hadList
            ? state.copyWith(votes: votes)
            : state.copyWith(
                status: ViewStatus.failure,
                votes: votes,
                errorMessage: failure.message,
              ),
      ),
      (reviews) => emit(state.copyWith(status: ViewStatus.success, reviews: reviews, votes: votes)),
    );
  }

  Future<void> markHelpful(ProductReview review) => _cast(review, helpful: true);

  Future<void> markUnhelpful(ProductReview review) => _cast(review, helpful: false);

  Future<void> _cast(ProductReview review, {required bool helpful}) async {
    // One vote per review, either way — read from the state, which already
    // holds the first press, so a fast second tap cannot vote twice.
    if (state.votes.votedOn(review.id)) return;
    final votes = state.votes;
    emit(
      helpful
          ? state.copyWith(
              votes: ReviewVotes(
                helpful: {...votes.helpful, review.id},
                unhelpful: votes.unhelpful,
              ),
              helpfulCounts: {...state.helpfulCounts, review.id: state.helpfulOf(review) + 1},
            )
          : state.copyWith(
              votes: ReviewVotes(
                helpful: votes.helpful,
                unhelpful: {...votes.unhelpful, review.id},
              ),
              unhelpfulCounts: {...state.unhelpfulCounts, review.id: state.unhelpfulOf(review) + 1},
            ),
    );
    final settled = await _vote(ReviewVote(reviewId: review.id, helpful: helpful));
    if (isClosed) return;
    settled.match((_) {}, (count) {
      emit(
        helpful
            ? state.copyWith(helpfulCounts: {...state.helpfulCounts, review.id: count})
            : state.copyWith(unhelpfulCounts: {...state.unhelpfulCounts, review.id: count}),
      );
    });
  }
}
