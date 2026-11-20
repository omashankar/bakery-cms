import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/widgets/choice_chips.dart';
import '../../domain/entities/address_label.dart';
import '../bloc/checkout_bloc.dart';
import '../bloc/checkout_event.dart';
import '../bloc/checkout_state.dart';
import 'address_label_text.dart';

class AddressLabelChips extends StatelessWidget {
  const AddressLabelChips({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocSelector<CheckoutBloc, CheckoutState, AddressLabel>(
      selector: (state) => state.address.label,
      builder: (context, label) => ChoiceChips<AddressLabel>(
        options: AddressLabel.values,
        selected: label,
        labelOf: (option) => option.text,
        onSelected: (option) =>
            context.read<CheckoutBloc>().add(CheckoutAddressLabelChanged(option)),
      ),
    );
  }
}
