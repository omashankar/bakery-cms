import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/cart_strings.dart';
import '../../../../core/widgets/app_app_bar.dart';
import '../../../../core/widgets/content_width.dart';
import '../../../../core/widgets/empty_view.dart';
import '../../../../core/widgets/page_heading.dart';
import '../../../../core/widgets/state_view.dart';
import '../../../checkout/presentation/bloc/checkout_step.dart';
import '../../../checkout/presentation/widgets/checkout_flow_app_bar.dart';
import '../../../delivery_area/presentation/widgets/delivery_area_bar.dart';
import '../bloc/cart_cubit.dart';
import '../bloc/cart_state.dart';
import '../widgets/cart_checkout_bar.dart';
import '../widgets/cart_line_tile.dart';

/// The cart tab, as the website's cart: the checkout header with its steps,
/// "Shopping Cart (n)", where it is going, then the lines as cards. Uses the
/// app-wide [CartCubit], so no provider here.
///
/// An empty cart keeps a plain header: steps over an empty cart would promise
/// a checkout that is not happening.
class CartPage extends StatelessWidget {
  const CartPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CartCubit, CartState>(
      builder: (context, state) {
        final cart = state.cart;
        final hasLines = !cart.isEmpty;
        return Scaffold(
          appBar: hasLines
              ? const CheckoutFlowAppBar(step: CheckoutStep.cart)
              : const AppAppBar(title: CartStrings.title),
          bottomNavigationBar: hasLines ? CartCheckoutBar(cart: cart) : null,
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
            builder: (_) => ListView(
              padding: const EdgeInsets.only(bottom: AppSpacing.xl),
              children: [
                ContentWidth(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      PageHeading(CartStrings.heading(cart.itemCount)),
                      // WHERE IT IS GOING, before anything else: a customer
                      // outside every zone finds out here, not at the address.
                      const DeliveryAreaBar(),
                      for (final item in cart.items)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(
                            AppSpacing.lg,
                            0,
                            AppSpacing.lg,
                            AppSpacing.md,
                          ),
                          child: CartLineTile(key: ValueKey(item.id), item: item),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
