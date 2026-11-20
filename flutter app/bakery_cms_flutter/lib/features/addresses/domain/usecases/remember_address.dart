import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../entities/address_book.dart';
import '../entities/saved_address.dart';
import '../repositories/address_book_repository.dart';

/// After an order: keep the address it went to, if the book does not have
/// that place yet. The first one saved becomes the default.
///
/// Never refuses: a full book, or one that already holds the place, is left
/// as it is and nothing is written.
class RememberAddress {
  const RememberAddress(
    this._repository, {
    required String Function() newId,
    DateTime Function() now = DateTime.now,
  })  : _newId = newId,
        _now = now;

  final AddressBookRepository _repository;
  final String Function() _newId;
  final DateTime Function() _now;

  Future<Either<Failure, AddressBook>> call(SavedAddress used) async {
    final current = await _repository.load();
    return current.match(
      (failure) async => Left(failure),
      (book) async {
        if (book.matching(used) != null || book.isFull) return Right(book);
        final now = _now();
        final added = used.copyWith(
          id: _newId(),
          label: used.label.trim().isEmpty ? used.kind.apiValue : used.label,
          isDefault: book.isEmpty,
          createdAt: now,
          updatedAt: now,
        );
        return book.upsert(added).match(
              (failure) async => Left(failure),
              _repository.save,
            );
      },
    );
  }
}
