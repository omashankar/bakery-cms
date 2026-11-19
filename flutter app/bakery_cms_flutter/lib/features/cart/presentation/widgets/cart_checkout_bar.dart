import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/cart_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../store/presentation/widgets/shop_price.dart';
import '../../domain/entities/cart.dart';

/// Subtotal and the way to checkout. The shop prices the order there; this
/// subtotal is the product prices only.
class CartCheckoutBar extends StatelessWidget {
  const CartCheckoutBar({super.key, required this.cart});

  final Cart cart;

  @override
  Widget build(BuildContext context) {
    final count = cart.itemCount;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: context.colors.surface,
        border: Border(top: BorderSide(color: context.colors.outline)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${CartStrings.subtotal} ($count ${count == 1 ? CartStrings.itemSuffix : CartStrings.itemsSuffix})',
                      style: context.text.titleSmall,
                    ),
                  ),
                  ShopPrice(amount: cart.subtotal, style: context.text.titleMedium),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                CartStrings.pricedAtCheckout,
                style: context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
              ),
              const SizedBox(height: AppSpacing.md),
              AppButton(
                label: CartStrings.checkout,
                icon: Icons.lock_outline,
                onPressed: () => context.push(AppRoutes.checkout),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
