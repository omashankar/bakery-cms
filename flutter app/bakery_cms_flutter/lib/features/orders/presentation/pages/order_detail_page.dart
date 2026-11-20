import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/orders_strings.dart';
import '../../../../core/utils/view_status.dart';
import '../../../../core/widgets/app_app_bar.dart';
import '../../../../core/widgets/app_snackbar.dart';
import '../../../../core/widgets/content_width.dart';
import '../../../../core/widgets/state_view.dart';
import '../bloc/order_detail_cubit.dart';
import '../bloc/order_detail_state.dart';
import '../widgets/order_detail_body.dart';

class OrderDetailPage extends StatelessWidget {
  const OrderDetailPage({super.key, required this.orderNumber});

  final String orderNumber;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => GetIt.I<OrderDetailCubit>()..load(orderNumber),
      child: _OrderDetailView(orderNumber: orderNumber),
    );
  }
}

class _OrderDetailView extends StatelessWidget {
  const _OrderDetailView({required this.orderNumber});

  final String orderNumber;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppAppBar(title: OrderStrings.orderTitle(orderNumber)),
      body: BlocConsumer<OrderDetailCubit, OrderDetailState>(
        listenWhen: (previous, current) =>
            previous.cancelStatus != current.cancelStatus ||
            previous.invoiceStatus != current.invoiceStatus,
        listener: (context, state) {
          if (state.invoiceStatus == ViewStatus.success && state.invoiceSentTo != null) {
            AppSnackbar.success(context, OrderStrings.invoiceSentTo(state.invoiceSentTo!));
          } else if (state.invoiceStatus == ViewStatus.failure) {
            final reason = state.invoiceError;
            AppSnackbar.error(
              context,
              reason == null
                  ? OrderStrings.invoiceFailed
                  : '${OrderStrings.invoiceFailed}: $reason',
            );
          }
          if (state.cancelStatus == ViewStatus.success) {
            AppSnackbar.success(context, OrderStrings.cancelled);
          } else if (state.cancelStatus == ViewStatus.failure && state.cancelError != null) {
            AppSnackbar.error(context, state.cancelError!);
          }
        },
        builder: (context, state) => StateView(
          status: state.status,
          isEmpty: state.details == null,
          errorMessage: state.errorMessage,
          onRetry: () => context.read<OrderDetailCubit>().load(orderNumber),
          builder: (context) => SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: ContentWidth(child: OrderDetailBody(details: state.details!)),
          ),
        ),
      ),
    );
  }
}
