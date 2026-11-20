import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/utils/context_extensions.dart';

/// The pin fixed at the map's centre. Its point sits on the centre, so the
/// icon is lifted by half its height.
class MapPin extends StatelessWidget {
  const MapPin({super.key});

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.iconLg),
          child: Icon(Icons.location_on, size: AppSpacing.iconLg, color: context.colors.primary),
        ),
      ),
    );
  }
}
