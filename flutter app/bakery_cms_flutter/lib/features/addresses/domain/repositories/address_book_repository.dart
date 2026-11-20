import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../entities/address_book.dart';

/// The signed-in customer's address book, kept on their account.
abstract interface class AddressBookRepository {
  /// The book as last read or saved, or fresh from the shop when there is no
  /// copy yet or [forceRefresh] is set.
  Future<Either<Failure, AddressBook>> load({bool forceRefresh = false});

  /// Replaces the whole book; answers with the book as the shop stored it.
  Future<Either<Failure, AddressBook>> save(AddressBook book);
}
