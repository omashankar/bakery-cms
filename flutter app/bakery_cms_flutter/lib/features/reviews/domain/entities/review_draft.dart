import 'package:equatable/equatable.dart';

/// A review the customer is about to send (`POST /api/reviews`), with the
/// website form's fields (`apps/website/components/product-review-form.tsx`).
class ReviewDraft extends Equatable {
  const ReviewDraft({
    required this.productSlug,
    required this.productName,
    required this.authorName,
    required this.rating,
    required this.body,
    this.authorEmail = '',
    this.title = '',
    this.photoUrls = const [],
  });

  /// "Up to 4 photos": a review, not an album (`submitReviewSchema`).
  static const int maxPhotos = 4;

  static const int minRating = 1;
  static const int maxRating = 5;

  final String productSlug;
  final String productName;
  final String authorName;
  final String authorEmail;
  final int rating;
  final String title;
  final String body;
  final List<String> photoUrls;

  @override
  List<Object?> get props => [
    productSlug,
    productName,
    authorName,
    authorEmail,
    rating,
    title,
    body,
    photoUrls,
  ];
}
