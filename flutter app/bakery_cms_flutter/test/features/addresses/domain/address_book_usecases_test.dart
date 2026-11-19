import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/entities/address_book.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/entities/saved_address.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/failures/address_book_full_failure.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/repositories/address_book_repository.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/usecases/delete_address.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/usecases/remember_address.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/usecases/save_address.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/usecases/set_default_address.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/address_label.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../address_fixtures.dart';

class _MockRepository extends Mock implements AddressBookRepository {}

void main() {
  late _MockRepository repository;
  final later = DateTime.utc(2026, 11, 17, 18);

  setUpAll(() => registerFallbackValue(const AddressBook()));

  setUp(() {
    repository = _MockRepository();
    // The shop answers a save with the book it stored.
    when(() => repository.save(any())).thenAnswer(
      (invocation) async => Right(invocation.positionalArguments.single as AddressBook),
    );
  });

  void holds(AddressBook book) =>
      when(() => repository.load()).thenAnswer((_) async => Right(book));

  AddressBook savedBook() =>
      verify(() => repository.save(captureAny())).captured.single as AddressBook;

  group('SaveAddress', () {
    SaveAddress build() => SaveAddress(repository, newId: () => 'fresh-id', now: () => later);

    test('a new address gets an id and its times, and the whole book is saved', () async {
      holds(bookOf(2));
      final result = await build()(saved('', line1: '9 Lake View'));

      final book = savedBook();
      expect(result, Right<Never, AddressBook>(book));
      expect(book.addresses, hasLength(3), reason: 'the whole book, not just the new one');
      final added = book.byId('fresh-id')!;
      expect(added.createdAt, later);
      expect(added.updatedAt, later);
      expect(added.isDefault, isFalse);
      expect(defaults(book), ['a0']);
    });

    test('an edit keeps its id and creation time; only updatedAt moves', () async {
      holds(bookOf(2));
      await build()(bookOf(2).byId('a1')!.copyWith(city: 'Bundi'));

      final edited = savedBook().byId('a1')!;
      expect(edited.city, 'Bundi');
      expect(edited.createdAt, monday);
      expect(edited.updatedAt, later);
    });

    test('a 21st address is refused and nothing is written', () async {
      holds(bookOf(AddressBook.maxAddresses));
      final result = await build()(saved('', line1: 'One too many'));

      expect(result.getLeft().toNullable(), isA<AddressBookFullFailure>());
      verifyNever(() => repository.save(any()));
    });

    test('when the book cannot be read nothing is written', () async {
      when(() => repository.load()).thenAnswer((_) async => const Left(NetworkFailure()));
      final result = await build()(saved('', line1: 'Anywhere'));

      expect(result.isLeft(), isTrue);
      verifyNever(() => repository.save(any()));
    });
  });

  test('DeleteAddress saves the book without it, the default handed on', () async {
    holds(bookOf(3));
    await DeleteAddress(repository)('a0');

    final book = savedBook();
    expect(book.addresses.map((a) => a.id), ['a1', 'a2']);
    expect(defaults(book), ['a1']);
  });

  test('SetDefaultAddress saves a book with exactly one default', () async {
    holds(bookOf(3));
    await SetDefaultAddress(repository)('a2');

    expect(defaults(savedBook()), ['a2']);
  });

  group('RememberAddress (after an order)', () {
    RememberAddress build() => RememberAddress(repository, newId: () => 'kept', now: () => later);

    const used = SavedAddress(
      kind: AddressLabel.office,
      fullName: 'Asha Verma',
      email: 'asha@example.com',
      phone: '9876543210',
      addressLine1: '9 Lake View',
      city: 'Kota',
      state: 'Rajasthan',
      pincode: '324005',
    );

    test('a new place is added, labelled by its kind, not as the default', () async {
      holds(bookOf(2));
      await build()(used);

      final book = savedBook();
      final kept = book.byId('kept')!;
      expect(kept.addressLine1, '9 Lake View');
      expect(kept.label, 'Office');
      expect(kept.isDefault, isFalse);
      expect(defaults(book), ['a0']);
    });

    test('into an empty book it becomes the default', () async {
      holds(const AddressBook());
      await build()(used);

      expect(defaults(savedBook()), ['kept']);
    });

    test('a place already saved (any case) is not saved again', () async {
      holds(AddressBook([saved('a', isDefault: true, line1: '9 LAKE view', pincode: '324005')]));
      final result = await build()(used);

      expect(result.isRight(), isTrue);
      verifyNever(() => repository.save(any()));
    });

    test('a full book is left alone, without a refusal', () async {
      holds(bookOf(AddressBook.maxAddresses));
      final result = await build()(used);

      expect(result.isRight(), isTrue);
      verifyNever(() => repository.save(any()));
    });
  });
}
