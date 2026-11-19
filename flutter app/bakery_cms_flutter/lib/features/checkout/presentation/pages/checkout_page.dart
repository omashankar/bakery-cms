import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
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
      child: Scaffold(
        appBar: const AppAppBar(title: CheckoutStrings.title),
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
    );
  }
}
