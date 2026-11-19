import 'package:bakery_cms_flutter/core/constants/strings/reviews_strings.dart';
import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/upload_cake_photo.dart';
import 'package:bakery_cms_flutter/features/media/domain/photo_picker.dart';
import 'package:bakery_cms_flutter/features/media/domain/photo_source.dart';
import 'package:bakery_cms_flutter/features/reviews/domain/entities/product_review.dart';
import 'package:bakery_cms_flutter/features/reviews/domain/entities/review_draft.dart';
import 'package:bakery_cms_flutter/features/reviews/domain/usecases/submit_review.dart';
import 'package:bakery_cms_flutter/features/reviews/presentation/bloc/review_form/review_form_cubit.dart';
import 'package:bakery_cms_flutter/features/reviews/presentation/bloc/review_form/review_form_state.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

class _MockSubmit extends Mock implements SubmitReview {}

class _MockPicker extends Mock implements PhotoPicker {}

class _MockUpload extends Mock implements UploadCakePhoto {}

/// The website's review form rules, with the POST mocked: nothing here
/// reaches the shop.
void main() {
  late _MockSubmit submit;
  late _MockPicker picker;
  late _MockUpload upload;
  const created = ProductReview(id: 'r-new', author: 'Riya', rating: 4, body: 'Lovely');

  setUpAll(() {
    registerFallbackValue(
      const ReviewDraft(productSlug: '', productName: '', authorName: '', rating: 5, body: ''),
    );
    registerFallbackValue(PhotoSource.gallery);
  });

  setUp(() {
    submit = _MockSubmit();
    picker = _MockPicker();
    upload = _MockUpload();
  });

  ReviewFormCubit build() => ReviewFormCubit(submit, picker, upload);

  Future<void> send(ReviewFormCubit cubit) =>
      cubit.submit(productSlug: 'mango-cake', productName: 'Mango Cake');

  test('starts at five stars, as the website does', () {
    expect(const ReviewFormState().rating, 5);
  });

  test('name and review are required; nothing is sent without them', () async {
    final cubit = build()..bodyChanged('Lovely');
    await send(cubit);
    expect(cubit.state.status, ViewStatus.failure);
    expect(cubit.state.errorMessage, ReviewsStrings.formMissing);
    cubit
      ..nameChanged('Riya')
      ..bodyChanged('   ');
    await send(cubit);
    expect(cubit.state.errorMessage, ReviewsStrings.formMissing);
    verifyNever(() => submit(any()));
  });

  test('an email is optional, but a given one must be real', () async {
    final cubit = build()
      ..nameChanged('Riya')
      ..bodyChanged('Lovely')
      ..emailChanged('riya@');
    await send(cubit);
    expect(cubit.state.errorMessage, ReviewsStrings.formBadEmail);
    verifyNever(() => submit(any()));
  });

  test('sends the website\'s fields, then resets to a sent form', () async {
    when(() => submit(any())).thenAnswer((_) async => const Right(created));
    final cubit = build()
      ..nameChanged('Riya')
      ..emailChanged(' riya@example.com ')
      ..ratingChanged(4)
      ..titleChanged('Great')
      ..bodyChanged('Lovely');
    await send(cubit);
    final draft = verify(() => submit(captureAny())).captured.single as ReviewDraft;
    expect(draft.productSlug, 'mango-cake');
    expect(draft.productName, 'Mango Cake');
    expect(draft.authorEmail, 'riya@example.com');
    expect(draft.rating, 4);
    expect(draft.title, 'Great');
    expect(cubit.state, const ReviewFormState(status: ViewStatus.success));
  });

  test('a failed send keeps everything typed', () async {
    when(() => submit(any())).thenAnswer((_) async => const Left(NetworkFailure()));
    final cubit = build()
      ..nameChanged('Riya')
      ..bodyChanged('Lovely');
    await send(cubit);
    expect(cubit.state.status, ViewStatus.failure);
    expect(cubit.state.errorMessage, ReviewsStrings.formNotSent);
    expect(cubit.state.authorName, 'Riya');
    expect(cubit.state.body, 'Lovely');
  });

  test('the shop\'s own refusal is shown as it said it', () async {
    when(
      () => submit(any()),
    ).thenAnswer((_) async => const Left(ServerFailure('Too many requests', null, 429)));
    final cubit = build()
      ..nameChanged('Riya')
      ..bodyChanged('Lovely');
    await send(cubit);
    expect(cubit.state.errorMessage, 'Too many requests');
  });

  group('photos', () {
    test('uploaded as chosen, through the photo upload, up to four', () async {
      var n = 0;
      when(() => picker.pick(any())).thenAnswer((_) async => '/cache/${n++}.jpg');
      when(
        () => upload(any()),
      ).thenAnswer((call) async => Right('https://cdn.test/${call.positionalArguments.single}'));
      final cubit = build();
      for (var i = 0; i < 4; i++) {
        await cubit.addPhoto(PhotoSource.gallery);
      }
      expect(cubit.state.photoUrls, hasLength(4));
      expect(cubit.state.canAddPhoto, isFalse);
      await cubit.addPhoto(PhotoSource.gallery);
      expect(cubit.state.notice, ReviewsStrings.formTooManyPhotos);
      verify(() => upload(any())).called(4);

      cubit.removePhoto(cubit.state.photoUrls.first);
      expect(cubit.state.photoUrls, hasLength(3));
    });

    test('photo storage being off is said in the review\'s own words', () async {
      when(() => picker.pick(any())).thenAnswer((_) async => '/cache/a.jpg');
      when(
        () => upload(any()),
      ).thenAnswer((_) async => const Left(ServerFailure('Place your order and…', null, 503)));
      final cubit = build();
      await cubit.addPhoto(PhotoSource.gallery);
      expect(cubit.state.notice, ReviewsStrings.formPhotosUnavailable);
      expect(cubit.state.uploading, isFalse);
      expect(cubit.state.photoUrls, isEmpty);
    });
  });
}
