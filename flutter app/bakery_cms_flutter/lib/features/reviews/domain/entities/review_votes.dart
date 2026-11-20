import 'package:equatable/equatable.dart';

/// The reviews this phone has already voted on: one vote per review, either
/// way (the website's `helpful-marks`, kept in the browser).
class ReviewVotes extends Equatable {
  const ReviewVotes({this.helpful = const {}, this.unhelpful = const {}});

  final Set<String> helpful;
  final Set<String> unhelpful;

  bool votedOn(String reviewId) => helpful.contains(reviewId) || unhelpful.contains(reviewId);

  @override
  List<Object?> get props => [helpful, unhelpful];
}
