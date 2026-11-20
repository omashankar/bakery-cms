import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../bloc/store_config_cubit.dart';
import '../bloc/store_config_state.dart';
import 'maintenance_screen.dart';

/// The whole app, or the shop's maintenance notice in its place.
///
/// The website closes the storefront and the account the same way
/// (`app/(storefront)/layout.tsx` and `app/account/layout.tsx` render
/// `MaintenanceScreen` when `maintenance.isClosed`). Until the settings have
/// loaded the app is shown: a guess must not close a shop that is open, and
/// the server refuses every quote and order while it is closed anyway.
class MaintenanceGate extends StatelessWidget {
  const MaintenanceGate({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<StoreConfigCubit, StoreConfigState>(
      buildWhen: (previous, current) =>
          previous.config?.maintenanceEnabled != current.config?.maintenanceEnabled ||
          previous.config?.maintenanceNotice != current.config?.maintenanceNotice ||
          previous.status != current.status,
      builder: (context, state) {
        final config = state.config;
        if (config == null || !config.maintenanceEnabled) return child;
        return MaintenanceScreen(
          siteName: config.siteName,
          message: config.maintenanceNotice,
          isChecking: state.status.isLoading,
          onCheckAgain: () => context.read<StoreConfigCubit>().load(),
        );
      },
    );
  }
}
