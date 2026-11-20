import 'package:bakery_cms_flutter/core/usecase/no_params.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/upload_cake_photo.dart';
import 'package:bakery_cms_flutter/features/media/domain/photo_picker.dart';
import 'package:bakery_cms_flutter/features/offers/domain/entities/coupon.dart';
import 'package:bakery_cms_flutter/features/offers/domain/usecases/get_live_coupons.dart';
import 'package:bakery_cms_flutter/features/offers/presentation/bloc/offers_cubit.dart';
import 'package:bakery_cms_flutter/features/product_questions/domain/entities/product_question.dart';
import 'package:bakery_cms_flutter/features/product_questions/domain/usecases/ask_product_question.dart';
import 'package:bakery_cms_flutter/features/product_questions/domain/usecases/get_product_questions.dart';
import 'package:bakery_cms_flutter/features/product_questions/presentation/bloc/ask/ask_question_cubit.dart';
import 'package:bakery_cms_flutter/features/product_questions/presentation/bloc/questions/product_questions_cubit.dart';
import 'package:bakery_cms_flutter/features/reviews/domain/entities/product_review.dart';
import 'package:bakery_cms_flutter/features/reviews/domain/entities/review_votes.dart';
import 'package:bakery_cms_flutter/features/reviews/domain/usecases/get_product_reviews.dart';
import 'package:bakery_cms_flutter/features/reviews/domain/usecases/get_review_votes.dart';
import 'package:bakery_cms_flutter/features/reviews/domain/usecases/submit_review.dart';
import 'package:bakery_cms_flutter/features/reviews/domain/usecases/vote_on_review.dart';
import 'package:bakery_cms_flutter/features/reviews/presentation/bloc/review_form/review_form_cubit.dart';
import 'package:bakery_cms_flutter/features/reviews/presentation/bloc/reviews/reviews_cubit.dart';
import 'package:fpdart/fpdart.dart';
import 'package:get_it/get_it.dart';
import 'package:mocktail/mocktail.dart';

class MockGetProductReviews extends Mock implements GetProductReviews {}

class MockGetReviewVotes extends Mock implements GetReviewVotes {}

class MockVoteOnReview extends Mock implements VoteOnReview {}

class MockGetProductQuestions extends Mock implements GetProductQuestions {}

class MockGetLiveCoupons extends Mock implements GetLiveCoupons {}

class MockSubmitReview extends Mock implements SubmitReview {}

class MockAskProductQuestion extends Mock implements AskProductQuestion {}

class _MockPicker extends Mock implements PhotoPicker {}

class _MockUpload extends Mock implements UploadCakePhoto {}

/// The below-the-fold blocks the product page provides (reviews, questions,
/// offers), registered with stubbed reads, so a page test needs no network.
/// Returns the stubs, for a test that wants to see what was asked.
({MockGetProductReviews reviews, MockGetProductQuestions questions, MockGetLiveCoupons coupons})
registerProductPageBlocks({
  List<ProductReview> reviews = const [],
  List<ProductQuestion> questions = const [],
  List<Coupon> coupons = const [],
}) {
  final getReviews = MockGetProductReviews();
  final getVotes = MockGetReviewVotes();
  final vote = MockVoteOnReview();
  final getQuestions = MockGetProductQuestions();
  final getCoupons = MockGetLiveCoupons();
  when(() => getReviews(any())).thenAnswer((_) async => Right(reviews));
  when(() => getVotes()).thenAnswer((_) async => const ReviewVotes());
  when(() => getQuestions(any())).thenAnswer((_) async => Right(questions));
  when(() => getCoupons(const NoParams())).thenAnswer((_) async => Right(coupons));
  GetIt.I
    ..registerFactory(() => ReviewsCubit(getReviews, getVotes, vote))
    ..registerFactory(() => ProductQuestionsCubit(getQuestions))
    ..registerFactory(() => OffersCubit(getCoupons))
    // The forms send nothing in a page test: their POSTs are never stubbed.
    ..registerFactory(() => ReviewFormCubit(MockSubmitReview(), _MockPicker(), _MockUpload()))
    ..registerFactory(() => AskQuestionCubit(MockAskProductQuestion()));
  return (reviews: getReviews, questions: getQuestions, coupons: getCoupons);
}
