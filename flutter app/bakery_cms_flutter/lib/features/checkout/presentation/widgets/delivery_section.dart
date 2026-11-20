import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/utils/date_formatter.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../../../core/widgets/choice_chips.dart';
import '../../../../core/widgets/form_section.dart';
import '../../../store/domain/entities/delivery_tier.dart';
import '../bloc/checkout_bloc.dart';
import '../bloc/checkout_event.dart';
import '../bloc/checkout_state.dart';
import 'field_caption.dart';
import 'horizontal_choices.dart';

/// Speed, day and window.
class DeliverySection extends StatelessWidget {
  const DeliverySection({super.key});

  static bool _changed(CheckoutState a, CheckoutState b) =>
      a.tiers != b.tiers ||
      a.tierId != b.tierId ||
      a.dates != b.dates ||
      a.date != b.date ||
      a.windows != b.windows ||
      a.timeSlot != b.timeSlot ||
      a.currency != b.currency;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CheckoutBloc, CheckoutState>(
      buildWhen: _changed,
      builder: (context, state) {
        final bloc = context.read<CheckoutBloc>();
        final tier = state.selectedTier;
        String tierText(DeliveryTier option) =>
            '${option.label}${CheckoutStrings.separator}'
            '${option.fee > 0 ? MoneyFormatter.format(option.fee, currency: state.currency) : CheckoutStrings.free}';

        return FormSection(
          title: CheckoutStrings.sectionDelivery,
          children: [
            if (state.tierRequired && state.tiers.isEmpty)
              const FieldCaption(CheckoutStrings.noTiers, isError: true),
            if (state.tiers.isNotEmpty) ...[
              const FieldCaption(CheckoutStrings.deliverySpeed),
              ChoiceChips<DeliveryTier>(
                options: state.tiers,
                selected: tier,
                labelOf: tierText,
                onSelected: (option) => bloc.add(CheckoutTierSelected(option.id)),
              ),
              if (tier != null && tier.description.isNotEmpty)
                FieldCaption(tier.description, muted: true),
            ],
            const FieldCaption(CheckoutStrings.deliveryDate),
            HorizontalChoices<DateTime>(
              options: state.dates,
              selected: state.date,
              labelOf: DateFormatter.day,
              onSelected: (date) => bloc.add(CheckoutDateSelected(date)),
            ),
            if (state.slotRequired) ...[
              const FieldCaption(CheckoutStrings.deliveryTime),
              if (state.windows.isEmpty)
                const FieldCaption(CheckoutStrings.noWindowsToday, isError: true)
              else
                ChoiceChips<String>(
                  options: state.windows,
                  selected: state.timeSlot,
                  labelOf: (window) => window,
                  onSelected: (window) => bloc.add(CheckoutSlotSelected(window)),
                ),
            ],
          ],
        );
      },
    );
  }
}
