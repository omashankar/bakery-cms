import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/constants/strings/reviews_strings.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/upload_cake_photo.dart';
import 'package:bakery_cms_flutter/features/media/domain/photo_picker.dart';
import 'package:bakery_cms_flutter/features/reviews/domain/entities/product_review.dart';
import 'package:bakery_cms_flutter/features/reviews/domain/entities/review_draft.dart';
import 'package:bakery_cms_flutter/features/reviews/domain/usecases/submit_review.dart';
import 'package:bakery_cms_flutter/features/reviews/presentation/bloc/review_form/review_form_cubit.dart';
import 'package:bakery_cms_flutter/features/reviews/presentation/widgets/review_form.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

class _MockSubmit extends Mock implements SubmitReview {}

class _MockPicker extends Mock implements PhotoPicker {}

class _MockUpload extends Mock implements UploadCakePhoto {}

/// The review form on screen, its POST mocked.
void main() {
  late _MockSubmit submit;

  setUpAll(
    () => registerFallbackValue(
      const ReviewDraft(productSlug: '', productName: '', authorName: '', rating: 5, body: ''),
    ),
  );

  setUp(() => submit = _MockSubmit());

  Future<bool Function()> pump(WidgetTester tester) async {
    var sent = false;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: SingleChildScrollView(
            child: BlocProvider(
              create: (_) => ReviewFormCubit(submit, _MockPicker(), _MockUpload()),
              child: ReviewForm(
                productSlug: 'mango-cake',
                productName: 'Mango Cake',
                onSent: () => sent = true,
              ),
            ),
          ),
        ),
      ),
    );
    return () => sent;
  }

  Future<void> tapSubmit(WidgetTester tester) async {
    await tester.ensureVisible(find.text(ReviewsStrings.formSubmit));
    await tester.tap(find.text(ReviewsStrings.formSubmit));
    await tester.pumpAndSettle();
  }

  testWidgets('empty: says what is missing and sends nothing', (tester) async {
    final sent = await pump(tester);
    await tapSubmit(tester);
    expect(find.text(ReviewsStrings.formMissing), findsOneWidget);
    verifyNever(() => submit(any()));
    expect(sent(), isFalse);
  });

  testWidgets('filled in: sends the review and says it is pending approval', (tester) async {
    when(() => submit(any())).thenAnswer(
      (_) async => const Right(ProductReview(id: 'r', author: 'Riya', rating: 3, body: 'Nice')),
    );
    final sent = await pump(tester);
    await tester.tap(find.byType(DropdownButtonFormField<int>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('3 stars').last);
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, ReviewsStrings.formName), 'Riya');
    await tester.enterText(find.widgetWithText(TextFormField, ReviewsStrings.formBody), 'Nice');
    await tapSubmit(tester);

    final draft = verify(() => submit(captureAny())).captured.single as ReviewDraft;
    expect(draft.rating, 3);
    expect(draft.authorName, 'Riya');
    expect(draft.body, 'Nice');
    expect(draft.productSlug, 'mango-cake');
    expect(find.text(ReviewsStrings.formSent), findsOneWidget);
    expect(sent(), isTrue);
  });
}
