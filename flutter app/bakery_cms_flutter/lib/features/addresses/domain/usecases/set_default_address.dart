import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../entities/address_book.dart';
import '../repositories/address_book_repository.dart';
import 'change_address_book.dart';

class SetDefaultAddress {
  const SetDefaultAddress(this._repository);

  final AddressBookRepository _repository;

  Future<Either<Failure, AddressBook>> call(String id) =>
      changeAddressBook(_repository, (book) => book.withDefault(id));
}
