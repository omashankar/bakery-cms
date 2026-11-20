import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../domain/entities/payment_method.dart';
import '../bloc/checkout_bloc.dart';
import '../bloc/checkout_state.dart';
import '../../../../core/widgets/app_button.dart';

/// The sticky "Place order · ₹1,099" button.
class PlaceOrderBar extends StatelessWidget {
  const PlaceOrderBar({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: context.colors.surface,
        border: Border(top: BorderSide(color: context.colors.outline)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child:
              BlocSelector<
                CheckoutBloc,
                CheckoutState,
                (double?, bool, PaymentMethod?, String, bool, bool)
              >(
                selector: (state) => (
                  state.quote?.totals.total,
                  state.isPlacing,
                  state.paymentMethod,
                  state.currency,
                  state.isLocked,
                  state.belowMinimumOrder,
                ),
                builder: (context, bar) {
                  final (total, placing, method, currency, locked, belowMinimum) = bar;
                  final action = method == PaymentMethod.online
                      ? CheckoutStrings.payAndPlaceOrder
                      : CheckoutStrings.placeOrder;
                  final label = total == null
                      ? action
                      : '$action${CheckoutStrings.separator}${MoneyFormatter.format(total, currency: currency)}';
                  // Locked once a payment went through: there is nothing to pay.
                  // Greyed under the minimum, as on the website: the alert
                  // above says why, on the screen.
                  return AppButton(
                    label: label,
                    isLoading: placing,
                    onPressed: locked || belowMinimum ? null : onPressed,
                  );
                },
              ),
        ),
      ),
    );
  }
}
