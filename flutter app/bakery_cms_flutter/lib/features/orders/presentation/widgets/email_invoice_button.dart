import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/strings/orders_strings.dart';
import '../../../../core/widgets/app_button.dart';
import '../bloc/order_detail_cubit.dart';
import '../bloc/order_detail_state.dart';

/// "Email invoice": the shop sends this order's invoice to the address on
/// the order (the website's invoice page has the same button).
class EmailInvoiceButton extends StatelessWidget {
  const EmailInvoiceButton({super.key});

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<OrderDetailCubit>();
    if (!cubit.canEmailInvoice) return const SizedBox.shrink();
    return BlocSelector<OrderDetailCubit, OrderDetailState, bool>(
      selector: (state) => state.invoiceStatus.isLoading,
      builder: (context, sending) => AppButton.secondary(
        label: OrderStrings.emailInvoice,
        icon: Icons.mail_outline,
        isLoading: sending,
        onPressed: cubit.emailInvoice,
      ),
    );
  }
}
