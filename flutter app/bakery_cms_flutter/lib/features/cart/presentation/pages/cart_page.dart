import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/strings/cart_strings.dart';
import '../../../../core/widgets/app_app_bar.dart';
import '../../../../core/widgets/empty_view.dart';
import '../../../../core/widgets/state_view.dart';
import '../bloc/cart_cubit.dart';
import '../bloc/cart_state.dart';
import '../widgets/cart_checkout_bar.dart';
import '../widgets/cart_line_tile.dart';

/// The cart tab. Uses the app-wide [CartCubit], so no provider here.
class CartPage extends StatelessWidget {
  const CartPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CartCubit, CartState>(
      builder: (context, state) {
        final cart = state.cart;
        return Scaffold(
          appBar: const AppAppBar(title: CartStrings.title),
          bottomNavigationBar: cart.isEmpty ? null : CartCheckoutBar(cart: cart),
          body: StateView(
            status: state.status,
            isEmpty: cart.isEmpty,
            errorMessage: state.errorMessage,
            onRetry: () => context.read<CartCubit>().load(),
            empty: EmptyView(
              icon: Icons.shopping_bag_outlined,
              title: CartStrings.emptyTitle,
              message: CartStrings.emptyMessage,
              actionLabel: CartStrings.startShopping,
              onAction: () => context.go(AppRoutes.home),
            ),
            builder: (_) => ListView.separated(
              itemCount: cart.items.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (_, index) => CartLineTile(item: cart.items[index]),
            ),
          ),
        );
      },
    );
  }
}
