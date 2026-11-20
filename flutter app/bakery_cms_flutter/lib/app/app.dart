import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../core/constants/app_strings.dart';
import '../features/auth/domain/usecases/watch_session_ended.dart';
import '../features/auth/presentation/bloc/auth_bloc.dart';
import '../features/auth/presentation/bloc/auth_event.dart';
import '../features/auth/presentation/widgets/session_end_wiper.dart';
import '../features/cart/presentation/bloc/cart_cubit.dart';
import '../features/delivery_area/presentation/bloc/delivery_area_cubit.dart';
import '../features/store/presentation/bloc/store_config_cubit.dart';
import '../features/store/presentation/widgets/maintenance_gate.dart';
import '../features/wishlist/presentation/bloc/wishlist_cubit.dart';
import 'di/injection.dart';
import 'router/app_router.dart';
import 'theme/app_theme.dart';

/// The root widget. Only the app-wide states are provided here (who is
/// signed in, the cart, the shop's settings, the wishlist, the delivery PIN
/// code); every screen provides its own bloc.
class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(create: (_) => sl<AuthBloc>()..add(const AuthStarted())),
        BlocProvider(create: (_) => sl<CartCubit>()..load()),
        BlocProvider(create: (_) => sl<StoreConfigCubit>()..load()),
        BlocProvider(create: (_) => sl<WishlistCubit>()..start()),
        // Read from the device before the home page paints: no request.
        BlocProvider(lazy: false, create: (_) => sl<DeliveryAreaCubit>()..load()),
      ],
      // A customer's session ending empties the cart, as the website does.
      child: SessionEndWiper(sessionEnded: sl<WatchSessionEnded>()(), child: const _AppView()),
    );
  }
}

class _AppView extends StatefulWidget {
  const _AppView();

  @override
  State<_AppView> createState() => _AppViewState();
}

class _AppViewState extends State<_AppView> {
  late final GoRouter _router = AppRouter.create(context.read<AuthBloc>());

  @override
  void dispose() {
    _router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: AppStrings.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      routerConfig: _router,
      // A shop in maintenance shows its notice instead of the app.
      builder: (context, child) => MaintenanceGate(child: child ?? const SizedBox.shrink()),
    );
  }
}
