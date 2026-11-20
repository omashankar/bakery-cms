import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/utils/validators.dart';
import '../../../../core/widgets/form_section.dart';
import '../../domain/entities/checkout_address.dart';
import '../../domain/entities/address_field.dart';
import '../bloc/checkout_bloc.dart';
import '../bloc/checkout_state.dart';
import 'address_label_chips.dart';
import 'address_text_field.dart';
import 'saved_address_chooser.dart';

class AddressSection extends StatelessWidget {
  const AddressSection({super.key});

  static const int _pincodeLength = 6;

  /// "+91 98765 43210" is 15; 13 cut that format off mid-number.
  static const int _phoneLength = 16;
  static const int _landmarkLength = 200;

  @override
  Widget build(BuildContext context) {
    // The chooser only for a customer with saved addresses: an empty first
    // child would still get the section's gap.
    return BlocSelector<CheckoutBloc, CheckoutState, bool>(
      selector: (state) => state.savedAddresses.isNotEmpty,
      builder: (context, hasSaved) => _fields(hasSaved),
    );
  }

  Widget _fields(bool hasSaved) {
    return FormSection(
      title: CheckoutStrings.sectionAddress,
      children: [
        if (hasSaved) const SavedAddressChooser(),
        const AddressTextField(
          field: AddressField.fullName,
          label: CheckoutStrings.fullName,
          validator: Validators.required,
          autofillHints: [AutofillHints.name],
        ),
        const AddressTextField(
          field: AddressField.email,
          label: CheckoutStrings.email,
          validator: Validators.email,
          keyboardType: TextInputType.emailAddress,
          autofillHints: [AutofillHints.email],
          textCapitalization: TextCapitalization.none,
        ),
        AddressTextField(
          field: AddressField.phone,
          label: CheckoutStrings.phone,
          validator: Validators.phone,
          keyboardType: TextInputType.phone,
          maxLength: _phoneLength,
          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9+ ]'))],
          autofillHints: const [AutofillHints.telephoneNumber],
          textCapitalization: TextCapitalization.none,
        ),
        // A second number to try, as the website asks under the phone.
        AddressTextField(
          field: AddressField.altPhone,
          label: CheckoutStrings.altPhone,
          keyboardType: TextInputType.phone,
          maxLength: CheckoutAddress.altPhoneMaxLength,
          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9+ ]'))],
          textCapitalization: TextCapitalization.none,
        ),
        const AddressTextField(
          field: AddressField.addressLine1,
          label: CheckoutStrings.addressLine1,
          validator: Validators.required,
          autofillHints: [AutofillHints.streetAddressLine1],
        ),
        const AddressTextField(
          field: AddressField.addressLine2,
          label: CheckoutStrings.addressLine2,
          autofillHints: [AutofillHints.streetAddressLine2],
        ),
        const AddressTextField(
          field: AddressField.landmark,
          label: CheckoutStrings.landmark,
          maxLength: _landmarkLength,
        ),
        const AddressTextField(
          field: AddressField.city,
          label: CheckoutStrings.city,
          validator: Validators.required,
          autofillHints: [AutofillHints.addressCity],
        ),
        const AddressTextField(
          field: AddressField.state,
          label: CheckoutStrings.state,
          validator: Validators.required,
          autofillHints: [AutofillHints.addressState],
        ),
        AddressTextField(
          field: AddressField.pincode,
          label: CheckoutStrings.pincode,
          validator: Validators.pincode,
          keyboardType: TextInputType.number,
          maxLength: _pincodeLength,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          autofillHints: const [AutofillHints.postalCode],
        ),
        // Free text and optional: nothing records the shop's country.
        const AddressTextField(
          field: AddressField.country,
          label: CheckoutStrings.country,
          maxLength: CheckoutAddress.countryMaxLength,
          autofillHints: [AutofillHints.countryName],
        ),
        const AddressLabelChips(),
      ],
    );
  }
}
