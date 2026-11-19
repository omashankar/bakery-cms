import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/cart_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../store/presentation/widgets/shop_currency.dart';
import '../../domain/entities/cart.dart';

/// The amount and the way on, always in reach, as the website's cart bar on
/// a phone: the subtotal, what the shop's own prices save, and the button.
/// The shop prices delivery and offers at checkout; this is the products.
///
/// The button says what it does: signed out, it leads to signing in first.
class CartCheckoutBar extends StatelessWidget {
  const CartCheckoutBar({super.key, required this.cart});

  final Cart cart;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final currency = context.shopCurrency;
    final signedIn = context.select<AuthBloc, bool>((bloc) => bloc.state.isAuthenticated);
    final savings = cart.compareAtSavings;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(top: BorderSide(color: colors.outlineVariant)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Row(
            children: [
              Flexible(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      CartStrings.subtotalOf(cart.itemCount),
                      style: context.text.labelSmall?.copyWith(color: colors.onSurfaceVariant),
                    ),
                    Text(
                      MoneyFormatter.format(cart.subtotal, currency: currency),
                      style: context.text.titleMedium,
                    ),
                    if (savings > 0)
                      Text(
                        CartStrings.youSave(MoneyFormatter.format(savings, currency: currency)),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.labelSmall?.copyWith(
                          color: colors.tertiary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                flex: 2,
                child: AppButton(
                  label: signedIn ? CartStrings.proceedToCheckout : CartStrings.signInToCheckout,
                  onPressed: () => context.push(AppRoutes.checkout),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
