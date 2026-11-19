import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/offers_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../domain/entities/cart_offer.dart';
import '../../domain/entities/offer_cart_line.dart';
import '../../domain/services/coupon_rules.dart';
import '../bloc/offers_cubit.dart';
import '../bloc/offers_state.dart';

/// The shop's live coupons for THIS basket, as the website's coupon panel
/// lists them under the code box (`cart-coupon-panel.tsx`, `offersForCart`):
/// each card says what it would save now and offers Apply, or what the basket
/// still needs ("Add ₹300 more to use it"). The applied code is left out.
/// Draws nothing when the shop has no live coupons.
///
/// Drop it next to the coupon box. It loads the coupons itself (shared and
/// cached), unless an [OffersCubit] is already provided above it.
class AvailableOffersList extends StatelessWidget {
  const AvailableOffersList({
    super.key,
    required this.subtotal,
    required this.currency,
    this.lines,
    this.appliedCode,
    this.onApply,
  });

  /// The basket's subtotal before any discount.
  final double subtotal;

  /// The shop's currency code (`StoreConfig.currency`).
  final String currency;

  /// The basket's lines, when known: a coupon kept to some categories is
  /// measured against only the money it can touch. Null measures every
  /// coupon against [subtotal], and a category coupon then shows as not
  /// applying, as on the website.
  final List<OfferCartLine>? lines;

  /// The code already applied, if any.
  final String? appliedCode;

  /// Apply this code (the caller's own coupon flow; the server decides).
  /// Null hides the Apply buttons.
  final ValueChanged<String>? onApply;

  @override
  Widget build(BuildContext context) {
    final view = _OffersView(list: this);
    if (_hasCubit(context)) return view;
    return BlocProvider(create: (_) => GetIt.I<OffersCubit>()..load(), child: view);
  }

  static bool _hasCubit(BuildContext context) {
    try {
      BlocProvider.of<OffersCubit>(context, listen: false);
      return true;
    } on FlutterError {
      return false;
    }
  }
}

class _OffersView extends StatelessWidget {
  const _OffersView({required this.list});

  final AvailableOffersList list;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<OffersCubit, OffersState>(
      builder: (context, state) {
        String money(double amount) => MoneyFormatter.format(amount, currency: list.currency);
        final offers = CouponRules.forCart(
          state.coupons,
          subtotal: list.subtotal,
          lines: list.lines,
          appliedCode: list.appliedCode,
          money: money,
          now: DateTime.now(),
          currency: list.currency,
        );
        if (offers.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(OffersStrings.otherCoupons, style: context.text.titleSmall),
            const SizedBox(height: AppSpacing.md),
            for (final offer in offers) ...[
              _OfferCard(offer: offer, money: money, onApply: list.onApply),
              const SizedBox(height: AppSpacing.md),
            ],
          ],
        );
      },
    );
  }
}

class _OfferCard extends StatelessWidget {
  const _OfferCard({required this.offer, required this.money, required this.onApply});

  final CartOffer offer;
  final MoneyText money;
  final ValueChanged<String>? onApply;

  @override
  Widget build(BuildContext context) {
    final check = offer.check;
    final saving = check?.saving ?? 0;
    final applies = check != null && check.applies;
    final status = applies
        ? '${OffersStrings.youWillSave} ${money(saving)} ${OffersStrings.withThisCode}'
        : offer.shortfall > 0
        ? '${OffersStrings.add} ${money(offer.shortfall)} ${OffersStrings.moreToUseIt}'
        : check?.message ?? '';
    final apply = onApply;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: context.colors.surfaceContainerHighest,
        border: Border.all(color: context.colors.outline, width: AppSpacing.borderWidth),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        applies ? '${OffersStrings.save} ${money(saving)}' : offer.label,
                        style: context.text.titleMedium,
                      ),
                      if (applies)
                        Text(
                          offer.label,
                          style: context.text.bodySmall?.copyWith(
                            color: context.colors.onSurfaceVariant,
                          ),
                        ),
                    ],
                  ),
                ),
                if (applies && apply != null)
                  OutlinedButton(
                    onPressed: () => apply(offer.code),
                    child: const Text(OffersStrings.apply),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            DecoratedBox(
              decoration: BoxDecoration(
                color: context.colors.surface,
                border: Border.all(color: context.colors.outline, width: AppSpacing.borderWidth),
                borderRadius: BorderRadius.circular(AppSpacing.xs),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.xxs,
                ),
                child: Text(offer.code, style: context.text.labelMedium),
              ),
            ),
            if (status.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                status,
                style: context.text.bodySmall?.copyWith(
                  color: applies ? context.colors.tertiary : context.colors.onSurfaceVariant,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
