import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/product_page_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../delivery_area/presentation/bloc/delivery_area_cubit.dart';
import '../../../delivery_area/presentation/widgets/delivery_area_bar.dart';
import '../../../delivery_area/presentation/widgets/earliest_delivery_text.dart';

/// Where it goes and how soon, on a soft tinted strip: the customer's PIN
/// code line (a tap opens the PIN code sheet) and the earliest delivery day.
///
/// When the shop does not deliver to the chosen PIN code the strip turns to
/// the error tint and says so; Add to cart still works, because checkout
/// decides against the real address.
///
/// No request of its own: it reads the app-wide `DeliveryAreaCubit`, so it
/// costs the page's first paint nothing.
class ProductDeliveryPanel extends StatelessWidget {
  const ProductDeliveryPanel({super.key});

  /// How strong the strip's tint is.
  static const double tintAlpha = 0.08;

  /// The bar's own text starts after its padding, pin icon and gap; the line
  /// under it starts there too.
  static const double textInset = AppSpacing.lg + AppSpacing.iconSm + AppSpacing.xs;

  @override
  Widget build(BuildContext context) {
    final notDelivered = context.select<DeliveryAreaCubit, bool>(
      (cubit) => cubit.state.isNotDelivered,
    );
    final tone = notDelivered ? context.colors.error : context.colors.tertiary;
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      child: Material(
        color: tone.withValues(alpha: tintAlpha),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const DeliveryAreaBar(),
              Padding(
                padding: const EdgeInsets.fromLTRB(textInset, 0, AppSpacing.lg, AppSpacing.sm),
                child: notDelivered
                    ? Text(
                        ProductPageStrings.notDeliveredHint,
                        style: context.text.bodySmall?.copyWith(color: context.colors.error),
                      )
                    : EarliestDeliveryText(
                        style: context.text.bodySmall?.copyWith(color: context.colors.tertiary),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
