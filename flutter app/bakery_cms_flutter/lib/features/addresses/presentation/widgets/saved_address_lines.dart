import '../../../../core/constants/strings/addresses_strings.dart';
import '../../../checkout/presentation/widgets/address_label_text.dart';
import '../../domain/entities/saved_address.dart';

/// How a saved address reads on a card and in the checkout chooser.
abstract final class SavedAddressLines {
  /// The customer's own label if the website let them type one, else
  /// Home / Office / Other.
  static String title(SavedAddress address) {
    final label = address.label.trim();
    return label.isEmpty ? address.kind.text : label;
  }

  static List<String> body(SavedAddress address) {
    String join(List<String> parts) =>
        parts.map((part) => part.trim()).where((part) => part.isNotEmpty).join(AddressesStrings.separator);
    final cityLine = join([address.city, address.state]);
    final place = address.pincode.trim().isEmpty ? cityLine : '$cityLine ${address.pincode.trim()}';
    return [
      join([address.fullName, address.phone]),
      join([address.addressLine1, address.addressLine2, address.landmark]),
      place.trim(),
    ].where((line) => line.isNotEmpty).toList();
  }

  /// One short line for a chip: "Home · 12 Park Road".
  static String short(SavedAddress address, String separator) {
    final line = address.addressLine1.trim();
    return line.isEmpty ? title(address) : '${title(address)}$separator$line';
  }
}
