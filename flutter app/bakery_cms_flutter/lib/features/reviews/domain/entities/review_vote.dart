import 'package:equatable/equatable.dart';

/// One vote: a review, and which thumb.
class ReviewVote extends Equatable {
  const ReviewVote({required this.reviewId, required this.helpful});

  final String reviewId;
  final bool helpful;

  @override
  List<Object?> get props => [reviewId, helpful];
}
