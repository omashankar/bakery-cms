import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/address_field.dart';
import '../bloc/checkout_bloc.dart';
import '../bloc/checkout_event.dart';
import '../bloc/checkout_state.dart';
import 'synced_text_field.dart';

/// One address field, rebuilt only when its own value changes.
class AddressTextField extends StatelessWidget {
  const AddressTextField({
    super.key,
    required this.field,
    required this.label,
    this.validator,
    this.keyboardType,
    this.inputFormatters,
    this.maxLength,
    this.autofillHints,
    this.textCapitalization = TextCapitalization.words,
  });

  final AddressField field;
  final String label;
  final FormFieldValidator<String>? validator;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final int? maxLength;
  final Iterable<String>? autofillHints;
  final TextCapitalization textCapitalization;

  @override
  Widget build(BuildContext context) {
    return BlocSelector<CheckoutBloc, CheckoutState, String>(
      selector: (state) => state.address.valueOf(field),
      builder: (context, value) => SyncedTextField(
        value: value,
        label: label,
        validator: validator,
        keyboardType: keyboardType,
        inputFormatters: inputFormatters,
        maxLength: maxLength,
        autofillHints: autofillHints,
        textCapitalization: textCapitalization,
        onChanged: (text) =>
            context.read<CheckoutBloc>().add(CheckoutAddressFieldChanged(field, text)),
      ),
    );
  }
}
