import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../entities/address_book.dart';
import '../repositories/address_book_repository.dart';

/// Load the current book, apply [change], save the result whole. A change
/// that is refused (full, not found) saves nothing.
Future<Either<Failure, AddressBook>> changeAddressBook(
  AddressBookRepository repository,
  Either<Failure, AddressBook> Function(AddressBook current) change,
) async {
  final current = await repository.load();
  return current.match(
    (failure) async => Left(failure),
    (book) => change(book).match(
      (failure) async => Left(failure),
      repository.save,
    ),
  );
}
