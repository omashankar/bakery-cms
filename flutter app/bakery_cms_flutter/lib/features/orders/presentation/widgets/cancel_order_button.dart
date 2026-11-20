import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/strings/orders_strings.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_dialog.dart';
import '../bloc/order_detail_cubit.dart';
import '../bloc/order_detail_state.dart';

/// Asks first, then cancels. Shown only while the order can be cancelled.
class CancelOrderButton extends StatelessWidget {
  const CancelOrderButton({super.key});

  Future<void> _confirm(BuildContext context) async {
    final cubit = context.read<OrderDetailCubit>();
    final confirmed = await AppDialog.confirm(
      context,
      title: OrderStrings.cancelTitle,
      message: OrderStrings.cancelMessage,
      confirmLabel: OrderStrings.cancelConfirm,
      cancelLabel: OrderStrings.keepOrder,
      destructive: true,
    );
    if (confirmed) await cubit.cancel();
  }

  @override
  Widget build(BuildContext context) {
    return BlocSelector<OrderDetailCubit, OrderDetailState, bool>(
      selector: (state) => state.cancelStatus.isLoading,
      builder: (context, isCancelling) => AppButton.secondary(
        label: OrderStrings.cancelOrder,
        icon: Icons.cancel_outlined,
        isLoading: isCancelling,
        onPressed: () => _confirm(context),
      ),
    );
  }
}
