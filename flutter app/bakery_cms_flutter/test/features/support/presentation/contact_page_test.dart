import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/constants/app_strings.dart';
import 'package:bakery_cms_flutter/core/constants/strings/support_strings.dart';
import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/auth_event.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/auth_state.dart';
import 'package:bakery_cms_flutter/features/support/domain/entities/contact_message.dart';
import 'package:bakery_cms_flutter/features/support/domain/entities/opening_hours.dart';
import 'package:bakery_cms_flutter/features/support/domain/entities/shop_contact.dart';
import 'package:bakery_cms_flutter/features/support/domain/repositories/support_repository.dart';
import 'package:bakery_cms_flutter/features/support/domain/usecases/get_shop_contact.dart';
import 'package:bakery_cms_flutter/features/support/domain/usecases/send_contact_message.dart';
import 'package:bakery_cms_flutter/features/support/presentation/bloc/contact_details_cubit.dart';
import 'package:bakery_cms_flutter/features/support/presentation/bloc/contact_form_cubit.dart';
import 'package:bakery_cms_flutter/features/support/presentation/pages/contact_page.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:get_it/get_it.dart';
import 'package:mocktail/mocktail.dart';

import '../../auth/auth_fixtures.dart';

class _MockAuthBloc extends MockBloc<AuthEvent, AuthState> implements AuthBloc {}

class _MockRepository extends Mock implements SupportRepository {}

/// The contact form as a customer meets it: what it refuses before sending,
/// what it sends, and where it lands. The POST is mocked; nothing reaches the
/// shop.
void main() {
  const contact = ShopContact(
    address: 'C-7, Borkhera, Kota',
    phone: '+91 88246 75118',
    email: 'hello@shop.test',
    openingHours: [OpeningHours(day: 'Monday - Sunday', hours: '9:00 AM - 11:00 PM')],
  );

  late _MockRepository repository;
  late _MockAuthBloc auth;

  setUpAll(() => registerFallbackValue(const ContactMessage(name: '', email: '', message: '')));

  setUp(() {
    repository = _MockRepository();
    auth = _MockAuthBloc();
    whenListen(
      auth,
      const Stream<AuthState>.empty(),
      initialState: const AuthState.unauthenticated(),
    );
    when(() => repository.getContact()).thenAnswer((_) async => const Right(contact));
    GetIt.I
      ..registerFactory(() => ContactDetailsCubit(GetShopContact(repository)))
      ..registerFactory(() => ContactFormCubit(SendContactMessage(repository)));
  });

  tearDown(() => GetIt.I.reset());

  Future<void> pumpPage(WidgetTester tester) async {
    // A tall phone, so a tap lands on what it names rather than off the edge.
    tester.view
      ..physicalSize = const Size(800, 2400)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      BlocProvider<AuthBloc>.value(
        value: auth,
        child: MaterialApp(theme: AppTheme.light, home: const ContactPage()),
      ),
    );
    await tester.pumpAndSettle();
  }

  Finder field(String key) => find.byKey(ValueKey(key));

  Future<void> tapSubmit(WidgetTester tester) async {
    await tester.ensureVisible(find.text(SupportStrings.submit));
    await tester.tap(find.text(SupportStrings.submit));
    await tester.pumpAndSettle();
  }

  testWidgets('shows the shop\'s published details and hours', (tester) async {
    await pumpPage(tester);

    expect(find.text(SupportStrings.formTitle), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text(SupportStrings.openingHours),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text(contact.address), findsOneWidget);
    expect(find.text(contact.phone), findsOneWidget);
    expect(find.text(contact.email), findsOneWidget);
    expect(find.text('9:00 AM - 11:00 PM'), findsOneWidget);
  });

  testWidgets('a blank form is refused before anything is sent', (tester) async {
    await pumpPage(tester);

    await tapSubmit(tester);

    // Name and message are required; email is required too.
    expect(find.text(AppStrings.validationRequired), findsNWidgets(3));
    verifyNever(() => repository.sendMessage(any()));
  });

  testWidgets('an email that is not one is refused', (tester) async {
    await pumpPage(tester);
    await tester.enterText(field('contact-name'), 'Riya');
    await tester.enterText(field('contact-email'), 'riya@');
    await tester.enterText(field('contact-message'), 'Hello');

    await tapSubmit(tester);

    expect(find.text(AppStrings.validationEmail), findsOneWidget);
    verifyNever(() => repository.sendMessage(any()));
  });

  testWidgets('a filled form is sent and lands on the thank-you view', (tester) async {
    when(() => repository.sendMessage(any())).thenAnswer((_) async => const Right(unit));
    await pumpPage(tester);
    await tester.enterText(field('contact-name'), 'Riya Sharma');
    await tester.enterText(field('contact-phone'), '98765 43210');
    await tester.enterText(field('contact-email'), 'riya@example.com');
    await tester.enterText(field('contact-subject'), 'Order inquiry');
    await tester.enterText(field('contact-message'), 'Do you deliver to Borkhera?');

    await tapSubmit(tester);

    final sent = verify(() => repository.sendMessage(captureAny())).captured.single;
    expect(
      sent,
      const ContactMessage(
        name: 'Riya Sharma',
        email: 'riya@example.com',
        message: 'Do you deliver to Borkhera?',
        phone: '98765 43210',
        subject: 'Order inquiry',
      ),
    );
    expect(find.text(SupportStrings.sentTitle), findsOneWidget);
    expect(find.text(SupportStrings.backToHome), findsOneWidget);
  });

  testWidgets('a refused send keeps the form and what was typed, and says why', (tester) async {
    when(() => repository.sendMessage(any())).thenAnswer(
      (_) async => const Left(ServerFailure('Too many requests. Please slow down.', null, 429)),
    );
    await pumpPage(tester);
    await tester.enterText(field('contact-name'), 'Riya');
    await tester.enterText(field('contact-email'), 'riya@example.com');
    await tester.enterText(field('contact-message'), 'Hello');

    await tapSubmit(tester);

    expect(find.text('Too many requests. Please slow down.'), findsOneWidget);
    expect(find.text(SupportStrings.sentTitle), findsNothing);
    expect(find.text('Hello'), findsOneWidget);
  });

  testWidgets('a signed-in customer finds their name and email filled in', (tester) async {
    whenListen(
      auth,
      const Stream<AuthState>.empty(),
      initialState: const AuthState.authenticated(testCustomer),
    );
    await pumpPage(tester);

    expect(find.text(testCustomer.name), findsOneWidget);
    expect(find.text(testCustomer.email), findsOneWidget);
  });
}
