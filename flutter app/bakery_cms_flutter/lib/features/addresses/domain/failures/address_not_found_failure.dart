import '../../../../core/constants/strings/addresses_strings.dart';
import '../../../../core/error/failure.dart';

/// The address was deleted (on another device, say) before this change.
class AddressNotFoundFailure extends Failure {
  const AddressNotFoundFailure() : super(AddressesStrings.notFound);
}
