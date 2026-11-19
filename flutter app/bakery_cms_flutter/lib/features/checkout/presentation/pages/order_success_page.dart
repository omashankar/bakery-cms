import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/content_width.dart';

/// The thank-you screen after an order is placed.
class OrderSuccessPage extends StatelessWidget {
  const OrderSuccessPage({super.key, required this.orderNumber});

  final String orderNumber;

  @override
  Widget build(BuildContext context) {
    // Reached with `go`, so it is alone on the stack: Android's back would
    // have closed the app. Back goes home instead.
    return PopScope(
      canPop: context.canPop(),
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) context.go(AppRoutes.home);
      },
      child: _SuccessBody(orderNumber: orderNumber),
    );
  }
}

class _SuccessBody extends StatelessWidget {
  const _SuccessBody({required this.orderNumber});

  final String orderNumber;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: ContentWidth(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(
                    Icons.check_circle_outline,
                    size: AppSpacing.iconXl,
                    color: context.colors.tertiary,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    CheckoutStrings.successTitle,
                    style: context.text.headlineSmall,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    CheckoutStrings.successMessage,
                    style: context.text.bodyMedium?.copyWith(
                      color: context.colors.onSurfaceVariant,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  AppCard(
                    child: Column(
                      children: [
                        Text(CheckoutStrings.orderNumberLabel, style: context.text.labelLarge),
                        const SizedBox(height: AppSpacing.xs),
                        SelectableText(orderNumber, style: context.text.titleLarge),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  AppButton(
                    label: CheckoutStrings.viewOrder,
                    onPressed: () => context.go(AppRoutes.orderDetail(orderNumber)),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  AppButton.secondary(
                    label: CheckoutStrings.continueShopping,
                    onPressed: () => context.go(AppRoutes.home),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
