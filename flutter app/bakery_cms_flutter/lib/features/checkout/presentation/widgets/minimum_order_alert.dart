import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/utils/money_formatter.dart';
import '../bloc/checkout_bloc.dart';
import '../bloc/checkout_state.dart';

/// "Minimum order value is ₹500. Add more items to continue." while the
/// subtotal is under the shop's minimum, as the website says it.
class MinimumOrderAlert extends StatelessWidget {
  const MinimumOrderAlert({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocSelector<CheckoutBloc, CheckoutState, (bool, double, String)>(
      selector: (state) => (state.belowMinimumOrder, state.minOrderValue, state.currency),
      builder: (context, view) {
        final (below, minimum, currency) = view;
        if (!below) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.lg),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: context.colors.errorContainer,
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            ),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Text(
                CheckoutStrings.minimumOrderAlert(
                  MoneyFormatter.format(minimum, currency: currency),
                ),
                style: context.text.bodyMedium?.copyWith(color: context.colors.onErrorContainer),
              ),
            ),
          ),
        );
      },
    );
  }
}
