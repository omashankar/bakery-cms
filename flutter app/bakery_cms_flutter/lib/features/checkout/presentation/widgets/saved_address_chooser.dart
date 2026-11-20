import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/addresses_strings.dart';
import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../addresses/domain/entities/saved_address.dart';
import '../../../addresses/presentation/widgets/saved_address_lines.dart';
import '../../domain/entities/checkout_address.dart';
import '../../domain/services/saved_address_mapper.dart';
import '../bloc/checkout_bloc.dart';
import '../bloc/checkout_event.dart';
import '../bloc/checkout_state.dart';
import 'field_caption.dart';
import 'horizontal_choices.dart';

/// The customer's saved addresses as one row of chips over the form. A tap
/// fills the form; the chip of the place the form shows is the selected one.
/// Nothing is shown to a customer with no saved address.
class SavedAddressChooser extends StatelessWidget {
  const SavedAddressChooser({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocSelector<CheckoutBloc, CheckoutState, _ChooserView>(
      selector: (state) => _ChooserView(state.savedAddresses, state.address),
      builder: (context, view) {
        if (view.saved.isEmpty) return const SizedBox.shrink();
        SavedAddress? selected;
        for (final saved in view.saved) {
          if (SavedAddressMapper.isSamePlace(view.address, saved)) {
            selected = saved;
            break;
          }
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const FieldCaption(AddressesStrings.chooserCaption),
            const SizedBox(height: AppSpacing.sm),
            HorizontalChoices<SavedAddress>(
              options: view.saved,
              selected: selected,
              labelOf: (saved) => SavedAddressLines.short(saved, CheckoutStrings.separator),
              onSelected: (saved) =>
                  context.read<CheckoutBloc>().add(CheckoutSavedAddressChosen(saved)),
            ),
          ],
        );
      },
    );
  }
}

class _ChooserView extends Equatable {
  const _ChooserView(this.saved, this.address);

  final List<SavedAddress> saved;
  final CheckoutAddress address;

  @override
  List<Object?> get props => [saved, address.addressLine1, address.pincode];
}
