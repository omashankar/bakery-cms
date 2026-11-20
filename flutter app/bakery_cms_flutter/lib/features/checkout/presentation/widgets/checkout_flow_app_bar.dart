import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../catalog/presentation/widgets/shop_title.dart';
import '../bloc/checkout_step.dart';
import 'checkout_progress.dart';

/// The header of the cart and the checkout, as the website's focused
/// checkout header: the shop's logo in the middle, "Secure checkout" at the
/// end, and the four steps under them. No search, no wishlist: nothing that
/// leads away from finishing the order.
class CheckoutFlowAppBar extends StatelessWidget implements PreferredSizeWidget {
  const CheckoutFlowAppBar({super.key, required this.step, this.onSelect});

  final CheckoutStep step;
  final ValueChanged<CheckoutStep>? onSelect;

  static const double _stepsHeight = CheckoutProgress.dotSize + AppSpacing.xl + AppSpacing.md;

  /// Below this width "Secure checkout" is said in one word, so the logo
  /// keeps the middle of a phone's bar.
  static const double _fullSecureLabelMinWidth = 400;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight + _stepsHeight);

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final wide = MediaQuery.sizeOf(context).width >= _fullSecureLabelMinWidth;
    return AppBar(
      centerTitle: true,
      title: const ShopTitle(centered: true),
      shape: Border(bottom: BorderSide(color: colors.outlineVariant)),
      actions: [
        Padding(
          padding: const EdgeInsetsDirectional.only(end: AppSpacing.lg),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.verified_user_outlined, size: AppSpacing.iconSm + AppSpacing.xs, color: colors.tertiary),
              const SizedBox(width: AppSpacing.xs),
              Text(
                wide ? CheckoutStrings.secureCheckout : CheckoutStrings.secureShort,
                style: context.text.labelMedium?.copyWith(color: colors.onSurfaceVariant),
              ),
            ],
          ),
        ),
      ],
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(_stepsHeight),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(AppSpacing.sm, AppSpacing.xs, AppSpacing.sm, AppSpacing.md),
          child: CheckoutProgress(current: step, onSelect: onSelect),
        ),
      ),
    );
  }
}
