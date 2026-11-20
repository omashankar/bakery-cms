import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/widgets/app_app_bar.dart';
import '../../../../core/widgets/state_view.dart';
import '../../../auth/presentation/bloc/auth_bloc.dart';
import '../../../auth/presentation/bloc/auth_state.dart';
import '../../../auth/presentation/bloc/auth_status.dart';
import '../../../store/presentation/bloc/store_config_cubit.dart';
import '../../../store/presentation/bloc/store_config_state.dart';
import '../../../cart/presentation/bloc/cart_cubit.dart';
import '../bloc/checkout_step.dart';
import '../bloc/checkout_step_cubit.dart';
import '../widgets/checkout_flow_app_bar.dart';
import '../widgets/checkout_scope.dart';

/// Address, delivery, payment and the shop's price, on one screen.
///
/// Waits for the shop's settings (delivery speeds, slots, payment methods),
/// which the app loads at start; a failure there offers a retry.
class CheckoutPage extends StatelessWidget {
  const CheckoutPage({super.key});

  @override
  Widget build(BuildContext context) {
    // Checkout is pushed over /cart, so the router's sign-in redirect never
    // sees it: a session that ends while it is open (a 401 on the quote)
    // left the customer here, signed out, with every press refused.
    return BlocListener<AuthBloc, AuthState>(
      listenWhen: (previous, current) =>
          previous.status == AuthStatus.authenticated &&
          current.status == AuthStatus.unauthenticated,
      listener: (context, _) => context.go(AppRoutes.loginThen(AppRoutes.checkout)),
      child: BlocProvider(
        create: (_) => GetIt.I<CheckoutStepCubit>(),
        child: Scaffold(
        appBar: const _CheckoutHeader(),
        body: BlocBuilder<StoreConfigCubit, StoreConfigState>(
          buildWhen: (previous, current) =>
              previous.status != current.status || previous.config != current.config,
          builder: (context, store) => StateView(
            status: store.status,
            isEmpty: store.config == null,
            errorMessage: store.errorMessage,
            onRetry: () => context.read<StoreConfigCubit>().load(),
            builder: (_) => CheckoutScope(config: store.config!),
          ),
        ),
      ),
      ),
    );
  }
}

/// The website's checkout header: the logo, Secure checkout, and the steps,
/// the current one following the scroll. Cart goes back to the cart; a step
/// already passed scrolls back to it. An empty cart keeps a plain header.
class _CheckoutHeader extends StatelessWidget implements PreferredSizeWidget {
  const _CheckoutHeader();

  static const CheckoutFlowAppBar _sizing = CheckoutFlowAppBar(step: CheckoutStep.address);

  @override
  Size get preferredSize => _sizing.preferredSize;

  void _select(BuildContext context, CheckoutStep step) {
    if (step != CheckoutStep.cart) {
      context.read<CheckoutStepCubit>().jumpTo(step);
    } else if (context.canPop()) {
      context.pop();
    } else {
      context.go(AppRoutes.cart);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasLines = context.select<CartCubit, bool>((cubit) => !cubit.state.cart.isEmpty);
    if (!hasLines) return const AppAppBar(title: CheckoutStrings.title);
    return BlocBuilder<CheckoutStepCubit, CheckoutStep>(
      builder: (context, step) => CheckoutFlowAppBar(
        step: step,
        onSelect: (selected) => _select(context, selected),
      ),
    );
  }
}
