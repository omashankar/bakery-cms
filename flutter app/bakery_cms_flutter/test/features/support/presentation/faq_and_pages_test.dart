import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/constants/strings/support_strings.dart';
import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/features/support/data/models/faq_item_model.dart';
import 'package:bakery_cms_flutter/features/support/domain/entities/page_block.dart';
import 'package:bakery_cms_flutter/features/support/domain/entities/page_block_type.dart';
import 'package:bakery_cms_flutter/features/support/domain/entities/shop_contact.dart';
import 'package:bakery_cms_flutter/features/support/domain/entities/shop_page.dart';
import 'package:bakery_cms_flutter/features/support/domain/repositories/support_repository.dart';
import 'package:bakery_cms_flutter/features/support/domain/usecases/get_faqs.dart';
import 'package:bakery_cms_flutter/features/support/domain/usecases/get_shop_contact.dart';
import 'package:bakery_cms_flutter/features/support/domain/usecases/get_shop_page.dart';
import 'package:bakery_cms_flutter/features/support/presentation/bloc/faq_cubit.dart';
import 'package:bakery_cms_flutter/features/support/presentation/bloc/shop_page_cubit.dart';
import 'package:bakery_cms_flutter/features/support/presentation/pages/faq_page.dart';
import 'package:bakery_cms_flutter/features/support/presentation/pages/shop_page_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:get_it/get_it.dart';
import 'package:mocktail/mocktail.dart';

import '../support_fixtures.dart';

class _MockRepository extends Mock implements SupportRepository {}

void main() {
  late _MockRepository repository;

  final liveFaqs =
      (liveData('content_faq.json')! as List)
          .cast<Map<String, dynamic>>()
          .map(FaqItemModel.fromJson)
          .map((model) => model.toEntity())
          .toList()
        ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));

  setUp(() {
    repository = _MockRepository();
    when(
      () => repository.getContact(),
    ).thenAnswer((_) async => const Right(ShopContact(phone: '+91 88246 75118')));
    GetIt.I
      ..registerFactory(
        () => FaqCubit(getFaqs: GetFaqs(repository), getShopContact: GetShopContact(repository)),
      )
      ..registerFactory(() => ShopPageCubit(GetShopPage(repository)));
  });

  tearDown(() => GetIt.I.reset());

  Future<void> pump(WidgetTester tester, Widget page) async {
    // A tall phone, so a tap lands on what it names rather than off the edge.
    tester.view
      ..physicalSize = const Size(800, 2400)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(MaterialApp(theme: AppTheme.light, home: page));
    await tester.pumpAndSettle();
  }

  group('FAQ screen (live FAQ capture)', () {
    setUp(() => when(() => repository.getFaqs()).thenAnswer((_) async => Right(liveFaqs)));

    testWidgets('lists the questions in order, the first one open', (tester) async {
      await pump(tester, const FaqPage());

      expect(find.text(liveFaqs.first.question), findsOneWidget);
      expect(find.text(liveFaqs.first.answer), findsOneWidget, reason: 'openFirst = 1');
      expect(find.text(liveFaqs[1].answer), findsNothing);
      final firstY = tester.getTopLeft(find.text(liveFaqs.first.question)).dy;
      final secondY = tester.getTopLeft(find.text(liveFaqs[1].question)).dy;
      expect(firstY, lessThan(secondY));
    });

    testWidgets('opening one question closes the other', (tester) async {
      await pump(tester, const FaqPage());

      await tester.tap(find.text(liveFaqs[1].question));
      await tester.pumpAndSettle();

      expect(find.text(liveFaqs[1].answer), findsOneWidget);
      expect(find.text(liveFaqs.first.answer), findsNothing);

      await tester.tap(find.text(liveFaqs[1].question));
      await tester.pumpAndSettle();
      expect(find.text(liveFaqs[1].answer), findsNothing, reason: 'a second tap closes it');
    });

    testWidgets('a category pill narrows the list and says so', (tester) async {
      await pump(tester, const FaqPage());

      await tester.tap(find.widgetWithText(ChoiceChip, SupportStrings.faqWedding));
      await tester.pumpAndSettle();

      final wedding = liveFaqs.where((f) => f.category?.apiValue == 'wedding').toList();
      expect(wedding, isNotEmpty);
      expect(find.text(wedding.first.question), findsOneWidget);
      final notWedding = liveFaqs.firstWhere((f) => f.category?.apiValue != 'wedding');
      expect(find.text(notWedding.question), findsNothing);
      expect(find.text(SupportStrings.faqShowing(SupportStrings.faqWedding)), findsOneWidget);
    });

    testWidgets('a search with no match says so', (tester) async {
      await pump(tester, const FaqPage());

      await tester.enterText(find.byKey(const ValueKey('faq-search')), 'zzzz-no-such-thing');
      await tester.pumpAndSettle();

      expect(find.text(SupportStrings.faqNoMatch), findsOneWidget);
    });

    testWidgets('the help card shows the shop\'s phone and links to Contact', (tester) async {
      await pump(tester, const FaqPage());

      await tester.scrollUntilVisible(
        find.text(SupportStrings.contactSupport),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('+91 88246 75118'), findsOneWidget);
    });
  });

  testWidgets('no published FAQs is an empty state, not an error', (tester) async {
    when(() => repository.getFaqs()).thenAnswer((_) async => const Right([]));
    await pump(tester, const FaqPage());
    expect(find.text(SupportStrings.faqEmpty), findsOneWidget);
  });

  group('shop page screen', () {
    testWidgets('draws the title and each block', (tester) async {
      when(() => repository.getPage('privacy')).thenAnswer(
        (_) async => const Right(
          ShopPage(
            slug: 'privacy',
            title: 'Privacy Policy',
            blocks: [
              PageBlock(id: 'h', type: PageBlockType.heading, content: 'What we collect'),
              PageBlock(id: 'p', type: PageBlockType.paragraph, content: 'Your email address.'),
            ],
          ),
        ),
      );
      await pump(tester, const ShopPagePage(slug: 'privacy'));

      expect(find.text('Privacy Policy'), findsOneWidget);
      expect(find.text('What we collect'), findsOneWidget);
      expect(find.text('Your email address.'), findsOneWidget);
    });

    testWidgets('a 404 says the page is not available, with no retry', (tester) async {
      when(
        () => repository.getPage(any()),
      ).thenAnswer((_) async => const Left(ServerFailure('Page not found', null, 404)));
      await pump(tester, const ShopPagePage(slug: 'terms'));

      expect(find.text(SupportStrings.pageNotFoundTitle), findsOneWidget);
      expect(find.text(SupportStrings.pageNotFoundMessage), findsOneWidget);
    });
  });
}
