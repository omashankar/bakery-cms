import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/entities/address_book.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/entities/saved_address.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/failures/address_book_full_failure.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/usecases/delete_address.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/usecases/load_address_book.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/usecases/save_address.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/usecases/set_default_address.dart';
import 'package:bakery_cms_flutter/features/addresses/presentation/bloc/address_book_action.dart';
import 'package:bakery_cms_flutter/features/addresses/presentation/bloc/address_book_cubit.dart';
import 'package:bakery_cms_flutter/features/addresses/presentation/bloc/address_book_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../address_fixtures.dart';

class _MockLoad extends Mock implements LoadAddressBook {}

class _MockSave extends Mock implements SaveAddress {}

class _MockDelete extends Mock implements DeleteAddress {}

class _MockSetDefault extends Mock implements SetDefaultAddress {}

void main() {
  late _MockLoad load;
  late _MockSave save;
  late _MockDelete delete;
  late _MockSetDefault setDefault;

  setUpAll(() => registerFallbackValue(const SavedAddress()));

  setUp(() {
    load = _MockLoad();
    save = _MockSave();
    delete = _MockDelete();
    setDefault = _MockSetDefault();
  });

  AddressBookCubit build() => AddressBookCubit(
        loadAddressBook: load,
        saveAddress: save,
        deleteAddress: delete,
        setDefaultAddress: setDefault,
      );

  final two = bookOf(2);
  final loaded = AddressBookState(status: ViewStatus.success, book: two);

  test('starts in the initial state, with nothing loaded', () {
    final cubit = build();
    expect(cubit.state.status, ViewStatus.initial);
    expect(cubit.state.book.isEmpty, isTrue);
    cubit.close();
  });

  group('loading the book', () {
    blocTest<AddressBookCubit, AddressBookState>(
      'loading → success with the book, default first',
      setUp: () => when(() => load(forceRefresh: true)).thenAnswer((_) async => Right(two)),
      build: build,
      act: (cubit) => cubit.load(forceRefresh: true),
      expect: () => [
        const AddressBookState(status: ViewStatus.loading),
        loaded,
      ],
      verify: (cubit) => expect(cubit.state.addresses.first.isDefault, isTrue),
    );

    blocTest<AddressBookCubit, AddressBookState>(
      'loading → success with an empty book (the empty view)',
      setUp: () => when(() => load()).thenAnswer((_) async => const Right(AddressBook())),
      build: build,
      act: (cubit) => cubit.load(),
      expect: () => [
        const AddressBookState(status: ViewStatus.loading),
        const AddressBookState(status: ViewStatus.success),
      ],
    );

    blocTest<AddressBookCubit, AddressBookState>(
      'loading → failure with the message to show',
      setUp: () => when(() => load()).thenAnswer((_) async => const Left(NetworkFailure())),
      build: build,
      act: (cubit) => cubit.load(),
      expect: () => [
        const AddressBookState(status: ViewStatus.loading),
        AddressBookState(status: ViewStatus.failure, errorMessage: const NetworkFailure().message),
      ],
    );
  });

  group('changes', () {
    final after = bookOf(3);

    blocTest<AddressBookCubit, AddressBookState>(
      'a save shows the book the shop stored',
      setUp: () => when(() => save(any())).thenAnswer((_) async => Right(after)),
      build: build,
      seed: () => loaded,
      act: (cubit) => cubit.save(saved('', line1: 'New')),
      expect: () => [
        loaded.copyWith(actionStatus: ViewStatus.loading, lastAction: AddressBookAction.save),
        AddressBookState(
          status: ViewStatus.success,
          book: after,
          actionStatus: ViewStatus.success,
          lastAction: AddressBookAction.save,
        ),
      ],
    );

    blocTest<AddressBookCubit, AddressBookState>(
      'a refused save keeps the list and says why',
      setUp: () => when(() => save(any())).thenAnswer((_) async => const Left(AddressBookFullFailure())),
      build: build,
      seed: () => loaded,
      act: (cubit) => cubit.save(saved('', line1: 'One too many')),
      expect: () => [
        loaded.copyWith(actionStatus: ViewStatus.loading, lastAction: AddressBookAction.save),
        AddressBookState(
          status: ViewStatus.success,
          book: two,
          actionStatus: ViewStatus.failure,
          lastAction: AddressBookAction.save,
          errorMessage: const AddressBookFullFailure().message,
        ),
      ],
    );

    blocTest<AddressBookCubit, AddressBookState>(
      'delete and make-default go through their own use cases',
      setUp: () {
        when(() => delete('a1')).thenAnswer((_) async => Right(bookOf(1)));
        when(() => setDefault('a0')).thenAnswer((_) async => Right(bookOf(1)));
      },
      build: build,
      seed: () => loaded,
      act: (cubit) async {
        await cubit.delete('a1');
        await cubit.makeDefault('a0');
      },
      verify: (cubit) {
        verify(() => delete('a1')).called(1);
        verify(() => setDefault('a0')).called(1);
        expect(cubit.state.lastAction, AddressBookAction.makeDefault);
        expect(cubit.state.book, bookOf(1));
      },
    );

    blocTest<AddressBookCubit, AddressBookState>(
      'a second change while one is saving is ignored, so two never race',
      setUp: () => when(() => delete(any())).thenAnswer((_) async => Right(bookOf(1))),
      build: build,
      seed: () => loaded.copyWith(actionStatus: ViewStatus.loading),
      act: (cubit) => cubit.delete('a1'),
      expect: () => const <AddressBookState>[],
      verify: (_) => verifyNever(() => delete(any())),
    );
  });
}
