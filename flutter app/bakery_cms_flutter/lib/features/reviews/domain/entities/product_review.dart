import 'package:equatable/equatable.dart';

/// One approved review of a product, as the product page shows it
/// (`getProductReviews` in the website's `apps/website/lib/product-details.ts`).
class ProductReview extends Equatable {
  const ProductReview({
    required this.id,
    required this.author,
    required this.rating,
    required this.body,
    this.title,
    this.date,
    this.adminReply,
    this.isFeatured = false,
    this.helpfulCount = 0,
    this.unhelpfulCount = 0,
    this.deliveredCity,
    this.photoUrls = const [],
  });

  final String id;
  final String author;

  /// 1 to 5.
  final double rating;
  final String body;

  /// The reviewer's own heading; the card falls back to the word for the
  /// score when there is none.
  final String? title;
  final DateTime? date;

  /// "Response from the shop".
  final String? adminReply;
  final bool isFeatured;
  final int helpfulCount;
  final int unhelpfulCount;

  /// Set by the SERVER only, when the reviewer's delivered order matched:
  /// "Verified Buyer, Kota". Absent for most reviews.
  final String? deliveredCity;

  /// The reviewer's own photos, stored by the shop.
  final List<String> photoUrls;

  @override
  List<Object?> get props => [
    id,
    author,
    rating,
    body,
    title,
    date,
    adminReply,
    isFeatured,
    helpfulCount,
    unhelpfulCount,
    deliveredCity,
    photoUrls,
  ];
}
