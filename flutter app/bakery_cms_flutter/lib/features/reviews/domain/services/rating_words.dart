import '../../../../core/constants/strings/reviews_strings.dart';

/// The word beside a score: "4.1 ★ Very Good" (the website's `ratingWord`).
abstract final class RatingWords {
  static String of(double rating) {
    if (rating >= 4.5) return ReviewsStrings.excellent;
    if (rating >= 4) return ReviewsStrings.veryGood;
    if (rating >= 3) return ReviewsStrings.good;
    if (rating >= 2) return ReviewsStrings.fair;
    return ReviewsStrings.poor;
  }
}
