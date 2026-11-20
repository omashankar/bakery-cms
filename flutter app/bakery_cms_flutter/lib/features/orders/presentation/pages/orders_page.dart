import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/orders_strings.dart';
import '../../../../core/widgets/app_app_bar.dart';
import '../../../../core/widgets/app_snackbar.dart';
import '../../../../core/widgets/empty_view.dart';
import '../../../../core/widgets/page_heading.dart';
import '../../../../core/widgets/state_view.dart';
import '../../../catalog/presentation/widgets/header_cart_button.dart';
import '../../../catalog/presentation/widgets/header_search_button.dart';
import '../../../catalog/presentation/widgets/shop_title.dart';
import '../bloc/orders_bloc.dart';
import '../bloc/orders_event.dart';
import '../bloc/orders_state.dart';
import '../widgets/order_list_tile.dart';

class OrdersPage extends StatelessWidget {
  const OrdersPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => GetIt.I<OrdersBloc>()..add(const OrdersRequested()),
      child: const _OrdersView(),
    );
  }
}

class _OrdersView extends StatelessWidget {
  const _OrdersView();

  Future<void> _refresh(BuildContext context) {
    final bloc = context.read<OrdersBloc>()..add(const OrdersRefreshed());
    return bloc.stream.firstWhere((state) => !state.status.isLoading);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // The shop's brand, as on every tab; the page's name is its heading.
      appBar: const AppAppBar(
        titleWidget: ShopTitle(),
        actions: [HeaderSearchButton(), HeaderCartButton()],
      ),
      body: BlocConsumer<OrdersBloc, OrdersState>(
        // A refresh that fails over a list already shown keeps the list.
        listenWhen: (previous, current) =>
            current.status.isFailure && !previous.status.isFailure && current.orders.isNotEmpty,
        listener: (context, state) => AppSnackbar.error(context, OrderStrings.refreshFailed),
        builder: (context, state) => StateView(
          status: state.status,
          isEmpty: state.orders.isEmpty,
          errorMessage: state.errorMessage,
          onRetry: () => context.read<OrdersBloc>().add(const OrdersRequested()),
          empty: EmptyView(
            icon: Icons.receipt_long_outlined,
            title: OrderStrings.emptyTitle,
            message: OrderStrings.emptyMessage,
            actionLabel: OrderStrings.startShopping,
            onAction: () => context.go(AppRoutes.home),
          ),
          builder: (context) => RefreshIndicator(
            onRefresh: () => _refresh(context),
            child: ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(AppSpacing.lg),
              itemCount: state.orders.length + 1,
              separatorBuilder: (_, index) =>
                  SizedBox(height: index == 0 ? AppSpacing.sm : AppSpacing.md),
              itemBuilder: (context, index) {
                if (index == 0) return const PageHeading(OrderStrings.title, padded: false);
                final order = state.orders[index - 1];
                return OrderListTile(
                  order: order,
                  onTap: () => context.push(AppRoutes.orderDetail(order.orderNumber)),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}
