import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../../../core/widgets/choice_chips.dart';
import '../../../../core/widgets/form_section.dart';
import '../../domain/entities/order_personalisation.dart';
import '../bloc/checkout_bloc.dart';
import '../bloc/checkout_event.dart';
import '../bloc/checkout_state.dart';
import 'field_caption.dart';
import 'sender_box.dart';

/// "Personalise this gift": the website's Personalize step (checkout-page.tsx)
/// on one screen. Every part is optional and goes to the shop as one
/// `personalisation` object, with the quote and with the order.
class PersonaliseSection extends StatelessWidget {
  const PersonaliseSection({super.key});

  static const int _messageLines = 3;

  @override
  Widget build(BuildContext context) {
    final bloc = context.read<CheckoutBloc>();
    return FormSection(
      title: CheckoutStrings.sectionPersonalise,
      children: [
        // The shop's own words; a shop that tagged no occasions is not asked.
        BlocSelector<CheckoutBloc, CheckoutState, (List<String>, String?)>(
          selector: (state) => (state.occasionOptions, state.occasion),
          builder: (context, view) {
            final (options, chosen) = view;
            if (options.isEmpty) return const SizedBox.shrink();
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const FieldCaption(CheckoutStrings.occasion),
                ChoiceChips<String>(
                  options: options,
                  selected: chosen,
                  labelOf: (option) => option,
                  // Pressing the chosen one again clears it: the field is optional.
                  onSelected: (option) =>
                      bloc.add(CheckoutOccasionSelected(option == chosen ? null : option)),
                ),
              ],
            );
          },
        ),
        AppTextField(
          label: CheckoutStrings.giftMessage,
          initialValue: bloc.state.giftMessage,
          maxLines: _messageLines,
          maxLength: OrderPersonalisation.messageMaxLength,
          textCapitalization: TextCapitalization.sentences,
          onChanged: (value) => bloc.add(CheckoutGiftMessageChanged(value)),
        ),
        const SenderBox(),
      ],
    );
  }
}
