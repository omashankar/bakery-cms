import 'package:equatable/equatable.dart';

import 'product_review.dart';
import 'rating_bar.dart';

/// What everyone who reviewed the product said, as one block: the average,
/// how many, a bar per star, and their photos. Counted from the same reviews
/// the list shows, never from a stored aggregate (the website's
/// `RatingSummary` in `components/storefront/rating-summary.tsx`).
class RatingSummary extends Equatable {
  const RatingSummary({
    required this.average,
    required this.total,
    required this.bars,
    required this.photos,
  });

  /// At most this many customer photos in the strip.
  static const int maxPhotos = 8;

  /// Null when there is nothing to summarise: the page has a sentence for it.
  static RatingSummary? of(List<ProductReview> reviews) {
    if (reviews.isEmpty) return null;
    final total = reviews.length;
    final sum = reviews.fold<double>(0, (running, review) => running + review.rating);
    // One decimal, like every other rating on the storefront.
    final average = (sum / total * 10).round() / 10;
    return RatingSummary(
      average: average,
      total: total,
      bars: [
        for (final stars in const [5, 4, 3, 2, 1])
          _bar(stars, reviews.where((review) => review.rating.round() == stars).length, total),
      ],
      photos: reviews.expand((review) => review.photoUrls).take(maxPhotos).toList(),
    );
  }

  static RatingBar _bar(int stars, int count, int total) =>
      RatingBar(stars: stars, count: count, share: (count / total * 100).round());

  final double average;
  final int total;

  /// Five down to one.
  final List<RatingBar> bars;
  final List<String> photos;

  @override
  List<Object?> get props => [average, total, bars, photos];
}
