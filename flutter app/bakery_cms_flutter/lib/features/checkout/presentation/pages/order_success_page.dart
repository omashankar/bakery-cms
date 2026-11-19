import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/constants/strings/orders_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/utils/date_formatter.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../../../core/widgets/app_app_bar.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/content_width.dart';
import '../../../../core/widgets/summary_row.dart';
import '../../../catalog/presentation/widgets/shop_title.dart';
import '../../../orders/domain/entities/order.dart';
import '../../../orders/presentation/bloc/order_detail_cubit.dart';
import '../../../orders/presentation/bloc/order_detail_state.dart';
import '../../../store/presentation/widgets/shop_currency.dart';

/// The thank-you screen after an order is placed, as the website's order
/// confirmation: the tick, "Thank you for your order!", the order number,
/// and what was ordered read back from the shop (the amount, how it is paid,
/// when it arrives, how many items), then Continue shopping / Track order.
///
/// The order WAS placed (this screen is only reached on the shop's yes), so
/// a summary that cannot be read back never turns the thanks into "not
/// found": the number stays, with a word on where to see the rest.
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
      child: BlocProvider(
        create: (_) => GetIt.I<OrderDetailCubit>()..load(orderNumber),
        child: _SuccessBody(orderNumber: orderNumber),
      ),
    );
  }
}

class _SuccessBody extends StatelessWidget {
  const _SuccessBody({required this.orderNumber});

  final String orderNumber;

  static const double _tickTileSize = 64;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      appBar: const AppAppBar(titleWidget: ShopTitle(), automaticallyImplyLeading: false),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: ContentWidth(
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
              border: Border.all(color: colors.outlineVariant),
            ),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: _tickTileSize,
                      height: _tickTileSize,
                      decoration: BoxDecoration(
                        color: colors.tertiaryContainer,
                        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
                      ),
                      child: Icon(
                        Icons.check_circle_outline,
                        size: AppSpacing.iconLg - AppSpacing.md,
                        color: colors.tertiary,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Semantics(
                    header: true,
                    liveRegion: true,
                    child: Text(
                      CheckoutStrings.successTitle,
                      style: context.text.headlineSmall,
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    CheckoutStrings.successMessage,
                    style: context.text.bodyMedium?.copyWith(color: colors.onSurfaceVariant),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  BlocBuilder<OrderDetailCubit, OrderDetailState>(
                    builder: (context, state) => _OrderSummary(
                      orderNumber: orderNumber,
                      order: state.details?.order,
                      loading: state.status.isPending,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  AppButton(
                    label: CheckoutStrings.continueShopping,
                    onPressed: () => context.go(AppRoutes.home),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  AppButton.secondary(
                    label: CheckoutStrings.trackOrder,
                    onPressed: () => context.go(AppRoutes.orderDetail(orderNumber)),
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

/// The order read back from the shop, in a soft box: the number, then the
/// amount, payment, delivery and items. While it loads, the number alone;
/// if it cannot be read, the number and where to see the rest.
class _OrderSummary extends StatelessWidget {
  const _OrderSummary({required this.orderNumber, required this.order, required this.loading});

  final String orderNumber;
  final Order? order;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final placed = order;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(color: colors.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(Icons.inventory_2_outlined, size: AppSpacing.iconSm, color: colors.primary),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: SelectableText(
                    CheckoutStrings.orderHeading(orderNumber),
                    style: context.text.titleSmall,
                  ),
                ),
              ],
            ),
            if (placed != null) ...[
              const SizedBox(height: AppSpacing.md),
              ..._rows(context, placed),
            ] else if (loading) ...[
              const SizedBox(height: AppSpacing.md),
              const LinearProgressIndicator(),
            ] else ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                CheckoutStrings.successDetailsUnavailable,
                style: context.text.bodySmall?.copyWith(color: colors.onSurfaceVariant),
              ),
            ],
          ],
        ),
      ),
    );
  }

  List<Widget> _rows(BuildContext context, Order placed) {
    final currency = context.shopCurrency;
    final date = placed.deliveryDate == null ? null : DateFormatter.fromApiDate(placed.deliveryDate!);
    final slot = placed.deliveryTimeSlot;
    return [
      SummaryRow(
        label: placed.isCashOnDelivery
            ? CheckoutStrings.amountDueOnDelivery
            : CheckoutStrings.totalPaid,
        value: MoneyFormatter.format(placed.totals.total, currency: currency),
      ),
      SummaryRow(
        label: CheckoutStrings.paymentLabel,
        value: placed.isCashOnDelivery ? OrderStrings.cashOnDelivery : OrderStrings.onlinePayment,
      ),
      // The booked day and its window, as the order page shows them; the
      // shop's estimate when no day was booked.
      if (date != null)
        SummaryRow(label: CheckoutStrings.deliveryLabel, value: DateFormatter.day(date))
      else if (placed.estimatedDelivery.isNotEmpty)
        SummaryRow(
          label: CheckoutStrings.estimatedDeliveryLabel,
          value: DateFormatter.timestamp(placed.estimatedDelivery),
        ),
      if (slot != null && slot.isNotEmpty) SummaryRow(label: OrderStrings.deliverySlot, value: slot),
      SummaryRow(label: CheckoutStrings.itemsLabel, value: '${placed.totals.itemCount}'),
    ];
  }
}
