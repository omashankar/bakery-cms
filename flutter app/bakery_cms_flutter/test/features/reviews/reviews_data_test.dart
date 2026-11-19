import 'dart:convert';
import 'dart:io';

import 'package:bakery_cms_flutter/core/network/api_envelope.dart';
import 'package:bakery_cms_flutter/core/network/api_client.dart';
import 'package:bakery_cms_flutter/features/reviews/data/datasources/review_votes_local_data_source_impl.dart';
import 'package:bakery_cms_flutter/features/reviews/data/datasources/reviews_remote_data_source_impl.dart';
import 'package:bakery_cms_flutter/features/reviews/data/models/product_review_model.dart';
import 'package:bakery_cms_flutter/features/reviews/data/repositories/reviews_repository_impl.dart';
import 'package:bakery_cms_flutter/features/reviews/domain/entities/product_review.dart';
import 'package:bakery_cms_flutter/features/reviews/domain/entities/rating_summary.dart';
import 'package:bakery_cms_flutter/features/reviews/domain/entities/review_draft.dart';
import 'package:bakery_cms_flutter/features/reviews/domain/services/rating_words.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _MockClient extends Mock implements ApiClient {}

Object? _fixture(String name) =>
    ApiEnvelope.unwrap(jsonDecode(File('test/fixtures/website/$name').readAsStringSync()));

void main() {
  group('the live GET /api/reviews answer (captured 2026-11-19)', () {
    test('a product with one approved review reads it whole', () {
      final data = _fixture('api_reviews.json')! as List<dynamic>;
      final review = ProductReviewModel.fromJson(data.single as Map<String, dynamic>).toEntity();
      expect(review.id, 'review-cefdf184-e4e4-4d3d-9d69-f0a23d669613');
      expect(review.author, 'Om Suman');
      expect(review.rating, 5);
      expect(review.title, 'nice cake');
      expect(review.body, 'nice cake');
      expect(review.date, DateTime.utc(2026, 10, 22, 11, 54, 18, 49));
      expect(review.helpfulCount, 0);
      expect(review.photoUrls, isEmpty);
      expect(review.deliveredCity, isNull);
    });

    test('a product with none answers an empty list', () {
      expect(_fixture('api_reviews_empty.json'), isEmpty);
    });

    test('the data source asks with the website\'s query and reads the list', () async {
      final client = _MockClient();
      when(
        () => client.get('/api/reviews', query: {'productSlug': 'mango-cake'}),
      ).thenAnswer((_) async => _fixture('api_reviews.json'));
      final reviews = await ReviewsRemoteDataSourceImpl(client).fetchApproved('mango-cake');
      expect(reviews.single.authorName, 'Om Suman');
    });
  });

  group('the body POST /api/reviews is sent (the website\'s submitStorefrontReview)', () {
    test('trimmed, with every blank optional field left OUT', () {
      final body = ReviewsRepositoryImpl.bodyOf(
        const ReviewDraft(
          productSlug: 'mango-cake',
          productName: 'Mango Cake',
          authorName: '  Riya ',
          rating: 4,
          body: ' Lovely ',
          authorEmail: '  ',
          title: '',
        ),
      );
      expect(body, {
        'productSlug': 'mango-cake',
        'cakeName': 'Mango Cake',
        'authorName': 'Riya',
        'rating': 4,
        'body': 'Lovely',
      });
    });

    test('email, title and photos go when given; the rating is kept to 1–5', () {
      final body = ReviewsRepositoryImpl.bodyOf(
        const ReviewDraft(
          productSlug: 's',
          productName: 'n',
          authorName: 'a',
          rating: 9,
          body: 'b',
          authorEmail: 'riya@example.com',
          title: 'Great',
          photoUrls: ['https://cdn.test/a.jpg'],
        ),
      );
      expect(body['authorEmail'], 'riya@example.com');
      expect(body['title'], 'Great');
      expect(body['photoUrls'], ['https://cdn.test/a.jpg']);
      expect(body['rating'], 5);
    });

    test('helpful and not-helpful post to their own paths and read the new count', () async {
      final client = _MockClient();
      when(
        () => client.post('/api/reviews/r%2F1/helpful'),
      ).thenAnswer((_) async => {'helpfulCount': 3});
      when(
        () => client.post('/api/reviews/r%2F1/unhelpful'),
      ).thenAnswer((_) async => {'unhelpfulCount': 1});
      final remote = ReviewsRemoteDataSourceImpl(client);
      expect(await remote.markHelpful('r/1'), 3);
      expect(await remote.markUnhelpful('r/1'), 1);
    });
  });

  test('a vote is remembered on the phone even when the request fails', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final client = _MockClient();
    when(() => client.post(any())).thenThrow(Exception('offline'));
    final repository = ReviewsRepositoryImpl(
      ReviewsRemoteDataSourceImpl(client),
      ReviewVotesLocalDataSourceImpl(prefs),
    );
    expect((await repository.markHelpful('r1')).isLeft(), isTrue);
    final votes = await repository.votes();
    expect(votes.helpful, {'r1'});
    expect(votes.votedOn('r1'), isTrue);
    expect(votes.votedOn('r2'), isFalse);
  });

  group('the rating summary (the website\'s RatingSummary)', () {
    ProductReview review(double rating, [List<String> photos = const []]) =>
        ProductReview(id: '$rating', author: 'a', rating: rating, body: 'b', photoUrls: photos);

    test('nothing to summarise without reviews', () {
      expect(RatingSummary.of(const []), isNull);
    });

    test('the average to one decimal, a bar per star and the photos', () {
      final summary = RatingSummary.of([
        review(5, ['p1']),
        review(5),
        review(4, ['p2', 'p3']),
        review(1),
      ])!;
      expect(summary.average, 3.8);
      expect(summary.total, 4);
      expect(summary.bars.map((b) => b.stars), [5, 4, 3, 2, 1]);
      expect(summary.bars.map((b) => b.count), [2, 1, 0, 0, 1]);
      expect(summary.bars.map((b) => b.share), [50, 25, 0, 0, 25]);
      expect(summary.photos, ['p1', 'p2', 'p3']);
    });

    test('the word for a score', () {
      expect(RatingWords.of(4.5), 'Excellent');
      expect(RatingWords.of(4.1), 'Very Good');
      expect(RatingWords.of(3), 'Good');
      expect(RatingWords.of(2.4), 'Fair');
      expect(RatingWords.of(1), 'Poor');
    });
  });
}
