import 'package:flutter/material.dart';

import '../constants/app_spacing.dart';

class AppLoader extends StatelessWidget {
  const AppLoader({super.key, this.size = AppSpacing.loaderSize});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SizedBox.square(
        dimension: size,
        child: const CircularProgressIndicator(strokeWidth: AppSpacing.loaderStroke),
      ),
    );
  }
}
