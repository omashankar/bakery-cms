import '../../../../core/constants/strings/addresses_strings.dart';
import '../../../../core/error/failure.dart';

/// The book already holds [AddressBook.maxAddresses]; the shop refuses more.
class AddressBookFullFailure extends Failure {
  const AddressBookFullFailure() : super(AddressesStrings.bookFull);
}
