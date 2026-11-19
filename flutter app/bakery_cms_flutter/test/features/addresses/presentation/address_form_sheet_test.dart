import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/constants/strings/addresses_strings.dart';
import 'package:bakery_cms_flutter/core/constants/strings/checkout_strings.dart';
import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/entities/address_book.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/entities/saved_address.dart';
import 'package:bakery_cms_flutter/features/addresses/presentation/bloc/address_book_cubit.dart';
import 'package:bakery_cms_flutter/features/addresses/presentation/bloc/address_book_state.dart';
import 'package:bakery_cms_flutter/features/addresses/presentation/widgets/address_form_sheet.dart';
import 'package:bakery_cms_flutter/features/delivery_area/domain/entities/pincode_place.dart';
import 'package:bakery_cms_flutter/features/delivery_area/domain/usecases/find_pincode_place.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/bloc/pincode_place_bloc.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../address_fixtures.dart';

class _MockAddressBookCubit extends MockCubit<AddressBookState> implements AddressBookCubit {}

class _MockFindPincodePlace extends Mock implements FindPincodePlace {}

/// The address book form edits what the website's address form edits: the
/// alternate phone and the country too (they were only carried before, never
/// editable), and "Set as default address", ticked for a book's first.
void main() {
  late _MockAddressBookCubit cubit;
  late _MockFindPincodePlace lookUp;

  const pause = Duration(milliseconds: 30);
  const kota = PincodePlace(pincode: '324005', state: 'Rajasthan', districts: ['Kota']);

  setUpAll(() => registerFallbackValue(const SavedAddress()));

  setUp(() {
    cubit = _MockAddressBookCubit();
    when(() => cubit.save(any())).thenAnswer((_) async {});
    lookUp = _MockFindPincodePlace();
    when(() => lookUp(any())).thenAnswer((_) async => const Right(null));
    when(() => lookUp('324005')).thenAnswer((_) async => const Right(kota));
  });

  Future<void> pumpForm(WidgetTester tester, SavedAddress initial, AddressBook book) async {
    tester.view
      ..physicalSize = const Size(800, 3200)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    whenListen(
      cubit,
      const Stream<AddressBookState>.empty(),
      initialState: AddressBookState(book: book),
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: MultiBlocProvider(
            providers: [
              BlocProvider<AddressBookCubit>.value(value: cubit),
              BlocProvider(create: (_) => PincodePlaceBloc(lookUp, pause: pause)),
            ],
            child: AddressFormSheet(initial: initial),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    // Past the PIN lookup's pause, so no timer outlives the test.
    await tester.pump(pause * 2);
  }

  Finder box(String label) => find.widgetWithText(TextField, label);

  String textOf(WidgetTester tester, String label) =>
      tester.widget<TextField>(box(label)).controller!.text;

  Future<void> typePincode(WidgetTester tester, String pin) async {
    await tester.enterText(box(CheckoutStrings.pincode), pin);
    await tester.pump(pause * 2);
    await tester.pump();
  }

  Future<SavedAddress> saveAndCapture(WidgetTester tester) async {
    await tester.tap(find.text(AddressesStrings.save));
    await tester.pumpAndSettle();
    return verify(() => cubit.save(captureAny())).captured.single as SavedAddress;
  }

  TextField field(WidgetTester tester, String key) => tester.widget<TextField>(
    find.descendant(of: find.byKey(ValueKey(key)), matching: find.byType(TextField)),
  );

  testWidgets('a new address starts in India, and is the default when the book is empty', (
    tester,
  ) async {
    await pumpForm(tester, const SavedAddress(), const AddressBook());

    expect(field(tester, 'address-country').controller!.text, SavedAddress.defaultCountry);
    final box = tester.widget<CheckboxListTile>(find.byKey(const ValueKey('address-default')));
    expect(box.value, isTrue);
  });

  testWidgets('a new address into a book that has some is not ticked default', (tester) async {
    await pumpForm(tester, const SavedAddress(), bookOf(2));
    final box = tester.widget<CheckboxListTile>(find.byKey(const ValueKey('address-default')));
    expect(box.value, isFalse);
  });

  testWidgets('an edit saves the alternate phone and country typed into the form', (tester) async {
    final existing = saved('a1').copyWith(country: 'India', altPhone: '9000000001');
    await pumpForm(tester, existing, AddressBook([existing]));

    expect(field(tester, 'address-alt-phone').controller!.text, '9000000001');
    await tester.enterText(find.byKey(const ValueKey('address-alt-phone')), '9123456780');
    await tester.enterText(find.byKey(const ValueKey('address-country')), 'Nepal');

    final sent = await saveAndCapture(tester);

    expect(sent.altPhone, '9123456780');
    expect(sent.country, 'Nepal');
    expect(sent.id, 'a1');
  });

  testWidgets('an edit that does not touch them keeps them as stored', (tester) async {
    final existing = saved('a1').copyWith(country: 'India', altPhone: '9000000001');
    await pumpForm(tester, existing, AddressBook([existing]));

    final sent = await saveAndCapture(tester);

    expect(sent.altPhone, '9000000001');
    expect(sent.country, 'India');
  });

  testWidgets('ticking "Set as default address" asks for it', (tester) async {
    final existing = saved('a2');
    await pumpForm(tester, existing, AddressBook([saved('a1', isDefault: true), existing]));

    await tester.tap(find.text(AddressesStrings.setAsDefault));
    await tester.pumpAndSettle();
    final sent = await saveAndCapture(tester);

    expect(sent.isDefault, isTrue);
  });

  group('the State from the PIN, as the website'
      's address book fills it', () {
    testWidgets('a full PIN fills an empty State, and leaves the City alone', (tester) async {
      await pumpForm(tester, const SavedAddress(), const AddressBook());
      expect(textOf(tester, CheckoutStrings.state), isEmpty);

      await typePincode(tester, '324005');

      expect(textOf(tester, CheckoutStrings.state), 'Rajasthan');
      expect(
        textOf(tester, CheckoutStrings.city),
        isEmpty,
        reason: 'the website fills the state only',
      );
      verify(() => lookUp('324005')).called(1);
    });

    testWidgets('never over a state the customer typed', (tester) async {
      await pumpForm(tester, const SavedAddress(), const AddressBook());
      await tester.enterText(box(CheckoutStrings.state), 'Raj.');

      await typePincode(tester, '324005');

      expect(textOf(tester, CheckoutStrings.state), 'Raj.');
    });

    testWidgets('five digits ask nothing; a directory that is down says nothing', (tester) async {
      when(() => lookUp('324009')).thenAnswer((_) async => const Left(NetworkFailure()));
      await pumpForm(tester, const SavedAddress(), const AddressBook());

      await typePincode(tester, '32400');
      verifyNever(() => lookUp('32400'));
      await typePincode(tester, '324009');

      expect(textOf(tester, CheckoutStrings.state), isEmpty);
      expect(find.text(const NetworkFailure().message), findsNothing);
    });
  });
}
