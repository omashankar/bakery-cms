import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../entities/address_book.dart';
import '../repositories/address_book_repository.dart';
import 'change_address_book.dart';

class DeleteAddress {
  const DeleteAddress(this._repository);

  final AddressBookRepository _repository;

  Future<Either<Failure, AddressBook>> call(String id) =>
      changeAddressBook(_repository, (book) => book.remove(id));
}
