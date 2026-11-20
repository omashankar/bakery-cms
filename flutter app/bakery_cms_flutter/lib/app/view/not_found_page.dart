import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/constants/app_strings.dart';
import '../../core/widgets/app_app_bar.dart';
import '../../core/widgets/empty_view.dart';
import '../router/app_routes.dart';

class NotFoundPage extends StatelessWidget {
  const NotFoundPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AppAppBar(),
      body: EmptyView(
        icon: Icons.search_off,
        title: AppStrings.errorNotFound,
        actionLabel: AppStrings.navHome,
        onAction: () => context.go(AppRoutes.home),
      ),
    );
  }
}
