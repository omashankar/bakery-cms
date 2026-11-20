import 'dart:async';

import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/reviews/domain/entities/product_review.dart';
import 'package:bakery_cms_flutter/features/reviews/domain/entities/review_vote.dart';
import 'package:bakery_cms_flutter/features/reviews/domain/entities/review_votes.dart';
import 'package:bakery_cms_flutter/features/reviews/domain/usecases/get_product_reviews.dart';
import 'package:bakery_cms_flutter/features/reviews/domain/usecases/get_review_votes.dart';
import 'package:bakery_cms_flutter/features/reviews/domain/usecases/vote_on_review.dart';
import 'package:bakery_cms_flutter/features/reviews/presentation/bloc/reviews/reviews_cubit.dart';
import 'package:bakery_cms_flutter/features/reviews/presentation/bloc/reviews/reviews_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

class _MockGet extends Mock implements GetProductReviews {}

class _MockVotes extends Mock implements GetReviewVotes {}

class _MockVote extends Mock implements VoteOnReview {}

void main() {
  const review = ProductReview(
    id: 'r1',
    author: 'Riya',
    rating: 5,
    body: 'Lovely',
    helpfulCount: 2,
  );
  late _MockGet getReviews;
  late _MockVotes getVotes;
  late _MockVote vote;

  setUpAll(() => registerFallbackValue(const ReviewVote(reviewId: '', helpful: true)));

  setUp(() {
    getReviews = _MockGet();
    getVotes = _MockVotes();
    vote = _MockVote();
    when(() => getVotes()).thenAnswer((_) async => const ReviewVotes());
  });

  ReviewsCubit build() => ReviewsCubit(getReviews, getVotes, vote);

  blocTest<ReviewsCubit, ReviewsState>(
    'loads the approved reviews for the product',
    setUp: () => when(() => getReviews('cake')).thenAnswer((_) async => const Right([review])),
    build: build,
    act: (cubit) => cubit.load('cake'),
    expect: () => [
      const ReviewsState(status: ViewStatus.loading),
      const ReviewsState(status: ViewStatus.success, reviews: [review]),
    ],
  );

  blocTest<ReviewsCubit, ReviewsState>(
    'a failed first read is a failure; a failed RE-read leaves the list alone',
    setUp: () =>
        when(() => getReviews('cake')).thenAnswer((_) async => const Left(NetworkFailure())),
    build: build,
    seed: () => const ReviewsState(status: ViewStatus.success, reviews: [review]),
    act: (cubit) => cubit.load('cake'),
    expect: () => <ReviewsState>[],
  );

  blocTest<ReviewsCubit, ReviewsState>(
    'helpful counts at once, then takes the shop\'s number, and votes only once',
    setUp: () => when(
      () => vote(const ReviewVote(reviewId: 'r1', helpful: true)),
    ).thenAnswer((_) async => const Right(7)),
    build: build,
    seed: () => const ReviewsState(status: ViewStatus.success, reviews: [review]),
    act: (cubit) async {
      await cubit.markHelpful(review);
      await cubit.markHelpful(review);
      await cubit.markUnhelpful(review);
    },
    expect: () => [
      const ReviewsState(
        status: ViewStatus.success,
        reviews: [review],
        votes: ReviewVotes(helpful: {'r1'}),
        helpfulCounts: {'r1': 3},
      ),
      const ReviewsState(
        status: ViewStatus.success,
        reviews: [review],
        votes: ReviewVotes(helpful: {'r1'}),
        helpfulCounts: {'r1': 7},
      ),
    ],
    verify: (_) => verify(() => vote(any())).called(1),
  );

  test('two fast taps send one vote', () async {
    final answer = Completer<Either<NetworkFailure, int>>();
    when(() => vote(any())).thenAnswer((_) => answer.future);
    final cubit = build()..emit(const ReviewsState(status: ViewStatus.success, reviews: [review]));
    final first = cubit.markUnhelpful(review);
    final second = cubit.markUnhelpful(review);
    answer.complete(const Left(NetworkFailure()));
    await Future.wait([first, second]);
    verify(() => vote(any())).called(1);
    expect(cubit.state.unhelpfulOf(review), 1, reason: 'kept, though the request failed');
    await cubit.close();
  });

  blocTest<ReviewsCubit, ReviewsState>(
    'a review this phone already voted on cannot be voted on again',
    setUp: () => when(() => getReviews('cake')).thenAnswer((_) async => const Right([review])),
    build: () {
      when(() => getVotes()).thenAnswer((_) async => const ReviewVotes(unhelpful: {'r1'}));
      return build();
    },
    act: (cubit) async {
      await cubit.load('cake');
      await cubit.markHelpful(review);
    },
    skip: 2,
    expect: () => <ReviewsState>[],
    verify: (_) => verifyNever(() => vote(any())),
  );
}
