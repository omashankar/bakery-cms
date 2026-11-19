import 'package:flutter/foundation.dart';

import '../../../../core/error/server_exception.dart';
import '../../../../core/network/api_client.dart';
import '../models/product_review_model.dart';
import 'reviews_remote_data_source.dart';

/// The shop's public review endpoints, as the website's `reviews-api.ts`
/// calls them. None needs a sign-in: reviews are anonymous and moderated.
class ReviewsRemoteDataSourceImpl implements ReviewsRemoteDataSource {
  const ReviewsRemoteDataSourceImpl(this._client);

  final ApiClient _client;

  static const String path = '/api/reviews';
  static const String productSlugQuery = 'productSlug';

  static String helpfulPath(String id) => '$path/${Uri.encodeComponent(id)}/helpful';
  static String unhelpfulPath(String id) => '$path/${Uri.encodeComponent(id)}/unhelpful';

  @override
  Future<List<ProductReviewModel>> fetchApproved(String productSlug) async {
    final data = await _client.get(path, query: {productSlugQuery: productSlug});
    if (data is! List) throw const ServerException();
    final reviews = <ProductReviewModel>[];
    for (final item in data.whereType<Map<String, dynamic>>()) {
      try {
        reviews.add(ProductReviewModel.fromJson(item));
      } catch (error) {
        // One odd review must not hide the others.
        debugPrint('Skipped a review that could not be read: $error');
      }
    }
    return reviews;
  }

  @override
  Future<ProductReviewModel> submit(Map<String, dynamic> body) async {
    final data = await _client.post(path, body: body);
    if (data is! Map<String, dynamic>) throw const ServerException();
    return ProductReviewModel.fromJson(data);
  }

  @override
  Future<int> markHelpful(String reviewId) => _count(helpfulPath(reviewId), 'helpfulCount');

  @override
  Future<int> markUnhelpful(String reviewId) => _count(unhelpfulPath(reviewId), 'unhelpfulCount');

  Future<int> _count(String endpoint, String field) async {
    final data = await _client.post(endpoint);
    final count = data is Map<String, dynamic> ? data[field] : null;
    if (count is! num) throw const ServerException();
    return count.toInt();
  }
}
