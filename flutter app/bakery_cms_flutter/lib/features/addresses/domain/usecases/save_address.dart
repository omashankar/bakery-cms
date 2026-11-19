import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../entities/address_book.dart';
import '../entities/saved_address.dart';
import '../repositories/address_book_repository.dart';
import 'change_address_book.dart';

/// Adds a new address or saves an edited one.
class SaveAddress {
  const SaveAddress(
    this._repository, {
    required String Function() newId,
    DateTime Function() now = DateTime.now,
  })  : _newId = newId,
        _now = now;

  final AddressBookRepository _repository;
  final String Function() _newId;
  final DateTime Function() _now;

  Future<Either<Failure, AddressBook>> call(SavedAddress address) {
    final now = _now();
    final stamped = address.isNew
        ? address.copyWith(id: _newId(), createdAt: now, updatedAt: now)
        : address.copyWith(updatedAt: now);
    return changeAddressBook(_repository, (book) => book.upsert(stamped));
  }
}
