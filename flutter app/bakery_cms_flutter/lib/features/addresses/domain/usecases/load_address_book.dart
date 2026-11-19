import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../entities/address_book.dart';
import '../repositories/address_book_repository.dart';

class LoadAddressBook {
  const LoadAddressBook(this._repository);

  final AddressBookRepository _repository;

  Future<Either<Failure, AddressBook>> call({bool forceRefresh = false}) =>
      _repository.load(forceRefresh: forceRefresh);
}
