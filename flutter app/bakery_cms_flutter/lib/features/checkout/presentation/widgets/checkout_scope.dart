import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/widgets/empty_view.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../cart/presentation/bloc/cart_cubit.dart';
import '../../../delivery_area/presentation/bloc/delivery_area_cubit.dart';
import '../../../store/domain/entities/store_config.dart';
import '../bloc/checkout_bloc.dart';
import '../bloc/checkout_event.dart';
import 'checkout_form.dart';

/// Starts a [CheckoutBloc] for this visit, from the cart as it is now.
///
/// The cart is read once, not watched: clearing it after the order is placed
/// must not swap the screen for "your cart is empty" on the way out.
class CheckoutScope extends StatelessWidget {
  const CheckoutScope({super.key, required this.config});

  final StoreConfig config;

  @override
  Widget build(BuildContext context) {
    final cart = context.read<CartCubit>().state.cart;
    if (cart.isEmpty) {
      return EmptyView(
        icon: Icons.shopping_bag_outlined,
        title: CheckoutStrings.emptyCartTitle,
        message: CheckoutStrings.emptyCartMessage,
        actionLabel: CheckoutStrings.browseProducts,
        onAction: () => context.go(AppRoutes.home),
      );
    }
    final customer = context.read<AuthBloc>().state.customer;
    final deliveryPincode = context.read<DeliveryAreaCubit>().state.pincode;
    return BlocProvider(
      create: (_) => GetIt.I<CheckoutBloc>()
        ..add(
          CheckoutStarted(
            cart: cart,
            config: config,
            customer: customer,
            deliveryPincode: deliveryPincode,
          ),
        ),
      child: const CheckoutForm(),
    );
  }
}
