import 'package:equatable/equatable.dart';

import '../../../../../core/utils/view_status.dart';
import '../../../domain/entities/product_review.dart';
import '../../../domain/entities/review_votes.dart';

/// The product's reviews: initial (not asked yet; the block is below the
/// fold) → loading → success | failure.
class ReviewsState extends Equatable {
  const ReviewsState({
    this.status = ViewStatus.initial,
    this.reviews = const [],
    this.votes = const ReviewVotes(),
    this.helpfulCounts = const {},
    this.unhelpfulCounts = const {},
    this.errorMessage,
  });

  final ViewStatus status;
  final List<ProductReview> reviews;
  final ReviewVotes votes;

  /// Counts seen to move since the list loaded, held apart from [reviews] so a
  /// re-read never has to decide which number is newer (the website does the
  /// same).
  final Map<String, int> helpfulCounts;
  final Map<String, int> unhelpfulCounts;
  final String? errorMessage;

  int helpfulOf(ProductReview review) => helpfulCounts[review.id] ?? review.helpfulCount;
  int unhelpfulOf(ProductReview review) => unhelpfulCounts[review.id] ?? review.unhelpfulCount;

  ReviewsState copyWith({
    ViewStatus? status,
    List<ProductReview>? reviews,
    ReviewVotes? votes,
    Map<String, int>? helpfulCounts,
    Map<String, int>? unhelpfulCounts,
    String? errorMessage,
  }) => ReviewsState(
    status: status ?? this.status,
    reviews: reviews ?? this.reviews,
    votes: votes ?? this.votes,
    helpfulCounts: helpfulCounts ?? this.helpfulCounts,
    unhelpfulCounts: unhelpfulCounts ?? this.unhelpfulCounts,
    errorMessage: errorMessage,
  );

  @override
  List<Object?> get props => [status, reviews, votes, helpfulCounts, unhelpfulCounts, errorMessage];
}
