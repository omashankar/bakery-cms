import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/constants/strings/support_strings.dart';
import 'package:bakery_cms_flutter/features/support/domain/entities/contact_channel.dart';
import 'package:bakery_cms_flutter/features/support/domain/entities/shop_contact.dart';
import 'package:bakery_cms_flutter/features/support/domain/services/contact_launcher.dart';
import 'package:bakery_cms_flutter/features/support/domain/services/contact_links.dart';
import 'package:bakery_cms_flutter/features/support/presentation/widgets/faq_help_card.dart';
import 'package:bakery_cms_flutter/features/support/presentation/widgets/get_in_touch_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:mocktail/mocktail.dart';

class _MockContactLauncher extends Mock implements ContactLauncher {}

/// The shop's phone and email on the Contact and FAQ pages open the dialer
/// and the mail app, as the website's `tel:` / `mailto:` links do; when no
/// app takes the link, the value is copied instead.
void main() {
  const contact = ShopContact(
    address: 'C-7, Borkhera, Kota',
    phone: '+91 88246 75118',
    email: 'hello@shop.test',
  );

  group('the links, as the website writes them', () {
    test('tel: with every space taken out of the number', () {
      expect(
        ContactLinks.of(ContactChannel.phone, ' +91 88246 75118 ').toString(),
        'tel:+918824675118',
      );
    });

    test('mailto: with the address as published', () {
      expect(
        ContactLinks.of(ContactChannel.email, 'hello@shop.test').toString(),
        'mailto:hello@shop.test',
      );
    });

    test('nothing published, nothing to open', () {
      expect(ContactLinks.of(ContactChannel.phone, '  '), isNull);
      expect(ContactLinks.of(ContactChannel.email, ''), isNull);
    });
  });

  group('a tap on the Contact and FAQ pages', () {
    late _MockContactLauncher launcher;
    late List<String> copied;

    setUpAll(() => registerFallbackValue(ContactChannel.phone));

    setUp(() {
      launcher = _MockContactLauncher();
      when(() => launcher.open(any(), any())).thenAnswer((_) async => true);
      GetIt.I.registerSingleton<ContactLauncher>(launcher);
    });

    tearDown(GetIt.I.reset);

    Future<void> pump(WidgetTester tester, Widget card) async {
      copied = [];
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (
        call,
      ) async {
        if (call.method == 'Clipboard.setData') {
          copied.add((call.arguments as Map<Object?, Object?>)['text']! as String);
        }
        return null;
      });
      addTearDown(
        () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          SystemChannels.platform,
          null,
        ),
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(body: SingleChildScrollView(child: card)),
        ),
      );
    }

    testWidgets('Contact: the phone calls and the email writes, nothing copied', (tester) async {
      await pump(tester, const GetInTouchCard(contact: contact));

      await tester.tap(find.text(contact.phone));
      await tester.pump();
      verify(() => launcher.open(ContactChannel.phone, contact.phone)).called(1);

      await tester.tap(find.text(contact.email));
      await tester.pump();
      verify(() => launcher.open(ContactChannel.email, contact.email)).called(1);

      expect(copied, isEmpty);
      expect(find.text(SupportStrings.copiedNoApp), findsNothing);
    });

    testWidgets('FAQ: the same links in the help card', (tester) async {
      await pump(tester, const FaqHelpCard(contact: contact));

      await tester.tap(find.text(contact.phone));
      await tester.pump();
      await tester.tap(find.text(contact.email));
      await tester.pump();

      verify(() => launcher.open(ContactChannel.phone, contact.phone)).called(1);
      verify(() => launcher.open(ContactChannel.email, contact.email)).called(1);
    });

    testWidgets('no app takes the link: the value is copied, and it says so', (tester) async {
      when(() => launcher.open(any(), any())).thenAnswer((_) async => false);
      await pump(tester, const GetInTouchCard(contact: contact));

      await tester.tap(find.text(contact.phone));
      await tester.pumpAndSettle();

      expect(copied, [contact.phone]);
      expect(find.text(SupportStrings.copiedNoApp), findsOneWidget);
    });

    testWidgets('the copy button still copies, and opens nothing', (tester) async {
      await pump(tester, const GetInTouchCard(contact: contact));

      await tester.tap(find.byTooltip(SupportStrings.copyHint).last); // the email's
      await tester.pumpAndSettle();

      expect(copied, [contact.email]);
      expect(find.text(SupportStrings.copied), findsOneWidget);
      verifyNever(() => launcher.open(any(), any()));
    });

    testWidgets('the address opens nothing and has no copy button', (tester) async {
      await pump(tester, const GetInTouchCard(contact: contact));

      await tester.tap(find.text(contact.address));
      await tester.pump();

      verifyNever(() => launcher.open(any(), any()));
      expect(find.byTooltip(SupportStrings.copyHint), findsNWidgets(2));
    });
  });
}
