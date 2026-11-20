import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/core/usecase/no_params.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/support/domain/entities/contact_message.dart';
import 'package:bakery_cms_flutter/features/support/domain/entities/faq_category.dart';
import 'package:bakery_cms_flutter/features/support/domain/entities/faq_item.dart';
import 'package:bakery_cms_flutter/features/support/domain/entities/shop_contact.dart';
import 'package:bakery_cms_flutter/features/support/domain/entities/shop_page.dart';
import 'package:bakery_cms_flutter/features/support/domain/usecases/get_faqs.dart';
import 'package:bakery_cms_flutter/features/support/domain/usecases/get_shop_contact.dart';
import 'package:bakery_cms_flutter/features/support/domain/usecases/get_shop_page.dart';
import 'package:bakery_cms_flutter/features/support/domain/usecases/send_contact_message.dart';
import 'package:bakery_cms_flutter/features/support/presentation/bloc/contact_details_cubit.dart';
import 'package:bakery_cms_flutter/features/support/presentation/bloc/contact_details_state.dart';
import 'package:bakery_cms_flutter/features/support/presentation/bloc/contact_form_cubit.dart';
import 'package:bakery_cms_flutter/features/support/presentation/bloc/contact_form_state.dart';
import 'package:bakery_cms_flutter/features/support/presentation/bloc/faq_cubit.dart';
import 'package:bakery_cms_flutter/features/support/presentation/bloc/faq_state.dart';
import 'package:bakery_cms_flutter/features/support/presentation/bloc/shop_page_cubit.dart';
import 'package:bakery_cms_flutter/features/support/presentation/bloc/shop_page_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

class _MockSend extends Mock implements SendContactMessage {}

class _MockGetFaqs extends Mock implements GetFaqs {}

class _MockGetContact extends Mock implements GetShopContact {}

class _MockGetPage extends Mock implements GetShopPage {}

void main() {
  const message = ContactMessage(name: 'Riya', email: 'riya@example.com', message: 'Hello');
  const contact = ShopContact(phone: '+91 88246 75118', email: 'hello@shop.test');
  const faq = FaqItem(
    id: '1',
    question: 'Eggless?',
    answer: 'Yes.',
    category: FaqCategory.general,
    sortOrder: 1,
  );

  setUpAll(() {
    registerFallbackValue(message);
    registerFallbackValue(const NoParams());
  });

  group('ContactFormCubit', () {
    late _MockSend send;
    setUp(() => send = _MockSend());

    blocTest<ContactFormCubit, ContactFormState>(
      'a sent message ends in success (the thank-you view)',
      setUp: () => when(() => send(any())).thenAnswer((_) async => const Right(unit)),
      build: () => ContactFormCubit(send),
      act: (cubit) => cubit.submit(message),
      expect: () => const [
        ContactFormState(status: ViewStatus.loading),
        ContactFormState(status: ViewStatus.success),
      ],
      verify: (_) => verify(() => send(message)).called(1),
    );

    blocTest<ContactFormCubit, ContactFormState>(
      'a refusal keeps the form, with the shop\'s words and the field it names',
      setUp: () => when(
        () => send(any()),
      ).thenAnswer((_) async => const Left(ServerFailure('Invalid email', 'email', 422))),
      build: () => ContactFormCubit(send),
      act: (cubit) => cubit.submit(message),
      expect: () => const [
        ContactFormState(status: ViewStatus.loading),
        ContactFormState(
          status: ViewStatus.failure,
          errorMessage: 'Invalid email',
          errorField: 'email',
        ),
      ],
    );

    blocTest<ContactFormCubit, ContactFormState>(
      'a second tap while sending, or after sending, sends nothing',
      setUp: () => when(() => send(any())).thenAnswer((_) async => const Right(unit)),
      build: () => ContactFormCubit(send),
      act: (cubit) async {
        final first = cubit.submit(message);
        await cubit.submit(message);
        await first;
        await cubit.submit(message);
      },
      verify: (_) => verify(() => send(any())).called(1),
    );
  });

  group('FaqCubit', () {
    late _MockGetFaqs getFaqs;
    late _MockGetContact getContact;
    setUp(() {
      getFaqs = _MockGetFaqs();
      getContact = _MockGetContact();
    });

    blocTest<FaqCubit, FaqState>(
      'loads the questions and the shop\'s phone and email',
      setUp: () {
        when(() => getFaqs(any())).thenAnswer((_) async => const Right([faq]));
        when(() => getContact(any())).thenAnswer((_) async => const Right(contact));
      },
      build: () => FaqCubit(getFaqs: getFaqs, getShopContact: getContact),
      act: (cubit) => cubit.load(),
      expect: () => const [
        FaqState(status: ViewStatus.loading),
        FaqState(status: ViewStatus.success, faqs: [faq], contact: contact),
      ],
    );

    blocTest<FaqCubit, FaqState>(
      'a contact read that fails still shows the questions',
      setUp: () {
        when(() => getFaqs(any())).thenAnswer((_) async => const Right([faq]));
        when(() => getContact(any())).thenAnswer((_) async => const Left(NetworkFailure()));
      },
      build: () => FaqCubit(getFaqs: getFaqs, getShopContact: getContact),
      act: (cubit) => cubit.load(),
      expect: () => const [
        FaqState(status: ViewStatus.loading),
        FaqState(status: ViewStatus.success, faqs: [faq]),
      ],
    );

    blocTest<FaqCubit, FaqState>(
      'a failed FAQ read is a failure to retry',
      setUp: () {
        when(() => getFaqs(any())).thenAnswer((_) async => const Left(NetworkFailure()));
        when(() => getContact(any())).thenAnswer((_) async => const Right(contact));
      },
      build: () => FaqCubit(getFaqs: getFaqs, getShopContact: getContact),
      act: (cubit) => cubit.load(),
      expect: () => [
        const FaqState(status: ViewStatus.loading),
        FaqState(status: ViewStatus.failure, errorMessage: const NetworkFailure().message),
      ],
    );

    test('a category and a search narrow what is visible', () async {
      when(() => getFaqs(any())).thenAnswer((_) async => const Right([faq]));
      when(() => getContact(any())).thenAnswer((_) async => const Right(contact));
      final cubit = FaqCubit(getFaqs: getFaqs, getShopContact: getContact);
      await cubit.load();

      cubit.selectCategory(FaqCategory.delivery);
      expect(cubit.state.visible, isEmpty);
      cubit.selectCategory(FaqCategory.general);
      expect(cubit.state.visible, [faq]);
      cubit.search('wedding');
      expect(cubit.state.visible, isEmpty);
      cubit
        ..selectCategory(FaqCategory.all)
        ..search('EGG');
      expect(cubit.state.visible, [faq]);
      await cubit.close();
    });
  });

  group('ShopPageCubit', () {
    late _MockGetPage getPage;
    setUp(() => getPage = _MockGetPage());
    const page = ShopPage(slug: 'privacy', title: 'Privacy Policy');

    blocTest<ShopPageCubit, ShopPageState>(
      'loads a published page',
      setUp: () => when(() => getPage('privacy')).thenAnswer((_) async => const Right(page)),
      build: () => ShopPageCubit(getPage),
      act: (cubit) => cubit.load('privacy'),
      expect: () => const [
        ShopPageState(status: ViewStatus.loading),
        ShopPageState(status: ViewStatus.success, page: page),
      ],
    );

    blocTest<ShopPageCubit, ShopPageState>(
      'a 404 (draft or unknown) is "not available", not a failure to retry',
      setUp: () => when(
        () => getPage('terms'),
      ).thenAnswer((_) async => const Left(ServerFailure('Page not found', null, 404))),
      build: () => ShopPageCubit(getPage),
      act: (cubit) => cubit.load('terms'),
      expect: () => const [
        ShopPageState(status: ViewStatus.loading),
        ShopPageState(status: ViewStatus.failure, notFound: true, errorMessage: 'Page not found'),
      ],
    );

    blocTest<ShopPageCubit, ShopPageState>(
      'a dropped connection is a failure to retry',
      setUp: () => when(() => getPage(any())).thenAnswer((_) async => const Left(NetworkFailure())),
      build: () => ShopPageCubit(getPage),
      act: (cubit) => cubit.load('privacy'),
      expect: () => [
        const ShopPageState(status: ViewStatus.loading),
        ShopPageState(status: ViewStatus.failure, errorMessage: const NetworkFailure().message),
      ],
    );
  });

  group('ContactDetailsCubit', () {
    late _MockGetContact getContact;
    setUp(() => getContact = _MockGetContact());

    blocTest<ContactDetailsCubit, ContactDetailsState>(
      'loads the shop\'s details',
      setUp: () => when(() => getContact(any())).thenAnswer((_) async => const Right(contact)),
      build: () => ContactDetailsCubit(getContact),
      act: (cubit) => cubit.load(),
      expect: () => const [
        ContactDetailsState(status: ViewStatus.loading),
        ContactDetailsState(status: ViewStatus.success, contact: contact),
      ],
    );
  });
}
