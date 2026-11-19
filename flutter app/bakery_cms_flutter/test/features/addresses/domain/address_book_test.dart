import 'package:bakery_cms_flutter/core/error/failure.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/entities/address_book.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/failures/address_book_full_failure.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/failures/address_not_found_failure.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';

import '../address_fixtures.dart';

AddressBook right(Either<Failure, AddressBook> result) =>
    result.getOrElse((failure) => throw StateError('expected a book, got $failure'));

void main() {
  group('adding', () {
    test("the book's first address is the default even if it did not ask", () {
      final book = right(const AddressBook().upsert(saved('a')));
      expect(defaults(book), ['a']);
    });

    test('a later address is not the default unless it asks', () {
      final book = right(bookOf(2).upsert(saved('new', line1: 'Elsewhere')));
      expect(defaults(book), ['a0']);
      expect(book.addresses, hasLength(3));
    });

    test('a new default takes it from the old one: still exactly one', () {
      final book = right(bookOf(3).upsert(saved('new', isDefault: true, line1: 'Elsewhere')));
      expect(defaults(book), ['new']);
    });

    test('the 20th fits; the 21st is refused and nothing changes', () {
      final nineteen = bookOf(19);
      final twenty = right(nineteen.upsert(saved('x', line1: 'Twentieth')));
      expect(twenty.addresses, hasLength(AddressBook.maxAddresses));
      expect(twenty.isFull, isTrue);

      final refused = twenty.upsert(saved('y', line1: 'Twenty-first'));
      expect(refused.getLeft().toNullable(), isA<AddressBookFullFailure>());
    });

    test('a full book still accepts an edit to one already in it', () {
      final full = bookOf(20);
      final edited = right(full.upsert(full.addresses[5].copyWith(addressLine1: 'Moved')));
      expect(edited.addresses, hasLength(20));
      expect(edited.byId('a5')!.addressLine1, 'Moved');
    });
  });

  group('editing', () {
    test('editing the default keeps it the default', () {
      final book = bookOf(3);
      final edited = right(book.upsert(book.byId('a0')!.copyWith(isDefault: false, city: 'Bundi')));
      expect(defaults(edited), ['a0']);
      expect(edited.byId('a0')!.city, 'Bundi');
    });

    test('an edit that asks to be default moves the default to it', () {
      final book = bookOf(3);
      final edited = right(book.upsert(book.byId('a2')!.copyWith(isDefault: true)));
      expect(defaults(edited), ['a2']);
    });
  });

  group('deleting', () {
    test('deleting the default hands it to the first one left', () {
      final book = right(bookOf(3).remove('a0'));
      expect(book.addresses.map((a) => a.id), ['a1', 'a2']);
      expect(defaults(book), ['a1']);
    });

    test('deleting another keeps the default where it was', () {
      final book = right(bookOf(3).remove('a2'));
      expect(defaults(book), ['a0']);
    });

    test('deleting the last leaves an empty book with no default', () {
      final book = right(bookOf(1).remove('a0'));
      expect(book.isEmpty, isTrue);
      expect(book.defaultAddress, isNull);
    });

    test('an id not in the book is refused', () {
      expect(bookOf(2).remove('gone').getLeft().toNullable(), isA<AddressNotFoundFailure>());
    });
  });

  group('the default', () {
    test('making one the default leaves exactly one', () {
      final book = right(bookOf(4).withDefault('a3'));
      expect(defaults(book), ['a3']);
    });

    test('a book stored with two defaults is repaired to one by any change', () {
      final messy = AddressBook([saved('a', isDefault: true), saved('b', isDefault: true, line1: 'B')]);
      expect(defaults(right(messy.withDefault('b'))), ['b']);
    });

    test('sorted lists the default first, then the most recently changed', () {
      final book = AddressBook([
        saved('old', updatedAt: DateTime.utc(2026, 1, 1), line1: 'Old'),
        saved('home', isDefault: true, updatedAt: DateTime.utc(2025, 1, 1)),
        saved('new', updatedAt: DateTime.utc(2026, 6, 1), line1: 'New'),
      ]);
      expect(book.sorted.map((a) => a.id), ['home', 'new', 'old']);
    });
  });

  group('the same place', () {
    test('line 1 and PIN match ignoring case and spacing', () {
      final book = AddressBook([saved('a', line1: '12 Park Road', pincode: '324001')]);
      expect(book.matching(saved('', line1: '  12  PARK road ', pincode: '324001')), isNotNull);
    });

    test('a different PIN or line 1 is a different place', () {
      final book = AddressBook([saved('a', line1: '12 Park Road', pincode: '324001')]);
      expect(book.matching(saved('', line1: '12 Park Road', pincode: '324002')), isNull);
      expect(book.matching(saved('', line1: '14 Park Road', pincode: '324001')), isNull);
    });
  });
}
