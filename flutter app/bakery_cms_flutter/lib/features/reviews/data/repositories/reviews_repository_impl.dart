import 'package:flutter/foundation.dart';
import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/error/guard.dart';
import '../../domain/entities/product_review.dart';
import '../../domain/entities/review_draft.dart';
import '../../domain/entities/review_votes.dart';
import '../../domain/repositories/reviews_repository.dart';
import '../datasources/review_votes_local_data_source.dart';
import '../datasources/reviews_remote_data_source.dart';

class ReviewsRepositoryImpl implements ReviewsRepository {
  const ReviewsRepositoryImpl(this._remote, this._votes);

  final ReviewsRemoteDataSource _remote;
  final ReviewVotesLocalDataSource _votes;

  @override
  Future<Either<Failure, List<ProductReview>>> getApproved(String productSlug) => guard(() async {
    final models = await _remote.fetchApproved(productSlug);
    return models.map((model) => model.toEntity()).toList();
  });

  @override
  Future<Either<Failure, ProductReview>> submit(ReviewDraft draft) =>
      guard(() async => (await _remote.submit(bodyOf(draft))).toEntity());

  /// The body the website's form sends (`submitStorefrontReview`): trimmed,
  /// the rating kept to 1–5, and every optional field left OUT when blank —
  /// an empty email would fail the server's email check.
  @visibleForTesting
  static Map<String, dynamic> bodyOf(ReviewDraft draft) {
    final email = draft.authorEmail.trim();
    final title = draft.title.trim();
    return {
      'productSlug': draft.productSlug,
      'cakeName': draft.productName,
      'authorName': draft.authorName.trim(),
      if (email.isNotEmpty) 'authorEmail': email,
      'rating': draft.rating.clamp(ReviewDraft.minRating, ReviewDraft.maxRating),
      if (title.isNotEmpty) 'title': title,
      'body': draft.body.trim(),
      if (draft.photoUrls.isNotEmpty) 'photoUrls': draft.photoUrls,
    };
  }

  @override
  Future<Either<Failure, int>> markHelpful(String reviewId) async {
    // Remembered whatever the request does: a reader who pressed it has
    // said what they think, and offering it again invites a second vote.
    await _votes.rememberHelpful(reviewId);
    return guard(() => _remote.markHelpful(reviewId));
  }

  @override
  Future<Either<Failure, int>> markUnhelpful(String reviewId) async {
    await _votes.rememberUnhelpful(reviewId);
    return guard(() => _remote.markUnhelpful(reviewId));
  }

  @override
  Future<ReviewVotes> votes() async =>
      ReviewVotes(helpful: _votes.helpful(), unhelpful: _votes.unhelpful());
}
