import '../models/product_review_model.dart';

abstract interface class ReviewsRemoteDataSource {
  Future<List<ProductReviewModel>> fetchApproved(String productSlug);

  /// The JSON body the website's form sends.
  Future<ProductReviewModel> submit(Map<String, dynamic> body);

  /// The new count for that thumb.
  Future<int> markHelpful(String reviewId);
  Future<int> markUnhelpful(String reviewId);
}
