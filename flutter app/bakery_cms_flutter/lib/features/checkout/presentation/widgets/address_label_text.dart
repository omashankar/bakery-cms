import '../../../../core/constants/strings/checkout_strings.dart';
import '../../domain/entities/address_label.dart';

extension AddressLabelText on AddressLabel {
  String get text => switch (this) {
    AddressLabel.home => CheckoutStrings.labelHome,
    AddressLabel.office => CheckoutStrings.labelOffice,
    AddressLabel.other => CheckoutStrings.labelOther,
  };
}
