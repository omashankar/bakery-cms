import 'package:equatable/equatable.dart';

/// One row of the rating summary: how many gave [stars], and that as a whole
/// percent of everyone.
class RatingBar extends Equatable {
  const RatingBar({required this.stars, required this.count, required this.share});

  final int stars;
  final int count;

  /// 0 to 100.
  final int share;

  @override
  List<Object?> get props => [stars, count, share];
}
