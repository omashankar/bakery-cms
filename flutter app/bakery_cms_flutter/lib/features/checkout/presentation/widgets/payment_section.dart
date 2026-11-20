import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/widgets/form_section.dart';
import '../../domain/entities/payment_method.dart';
import '../bloc/checkout_bloc.dart';
import '../bloc/checkout_event.dart';
import '../bloc/checkout_state.dart';
import 'field_caption.dart';

class PaymentSection extends StatelessWidget {
  const PaymentSection({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocSelector<
      CheckoutBloc,
      CheckoutState,
      (bool, bool, PaymentMethod?, bool, List<String>)
    >(
      selector: (state) => (
        state.onlineAvailable,
        state.codAvailable,
        state.paymentMethod,
        state.codOffered,
        state.codBlockedBy,
      ),
      builder: (context, payment) {
        final (online, cod, selected, codOffered, codBlockedBy) = payment;
        return FormSection(
          title: CheckoutStrings.sectionPayment,
          children: [
            // Why there is no cash option, on a shop that offers cash.
            if (codOffered && codBlockedBy.isNotEmpty)
              FieldCaption(CheckoutStrings.codUnavailableFor(codBlockedBy), muted: true),
            if (!online && !cod)
              const FieldCaption(CheckoutStrings.noPaymentMethod, isError: true)
            else
              RadioGroup<PaymentMethod>(
                groupValue: selected,
                onChanged: (method) {
                  if (method != null) {
                    context.read<CheckoutBloc>().add(CheckoutPaymentMethodSelected(method));
                  }
                },
                child: Column(
                  children: [
                    if (online)
                      const RadioListTile<PaymentMethod>(
                        contentPadding: EdgeInsets.zero,
                        value: PaymentMethod.online,
                        title: Text(CheckoutStrings.payOnline),
                        subtitle: Text(CheckoutStrings.payOnlineHint),
                      ),
                    if (cod)
                      const RadioListTile<PaymentMethod>(
                        contentPadding: EdgeInsets.zero,
                        value: PaymentMethod.cod,
                        title: Text(CheckoutStrings.payCod),
                        subtitle: Text(CheckoutStrings.payCodHint),
                      ),
                  ],
                ),
              ),
          ],
        );
      },
    );
  }
}
