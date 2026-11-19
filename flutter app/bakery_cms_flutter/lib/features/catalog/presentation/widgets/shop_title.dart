import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/widgets/app_network_image.dart';
import '../../../store/presentation/bloc/store_config_cubit.dart';
import '../../../store/presentation/bloc/store_config_state.dart';

/// The shop's mark and name, from its settings.
class ShopTitle extends StatelessWidget {
  const ShopTitle({super.key});

  static const double markSize = 32;

  @override
  Widget build(BuildContext context) {
    return BlocSelector<StoreConfigCubit, StoreConfigState, (String, String)>(
      selector: (state) =>
          (state.config?.siteName ?? AppStrings.appName, state.config?.faviconUrl ?? ''),
      builder: (_, shop) {
        final (name, mark) = shop;
        return Row(
          children: [
            if (mark.isNotEmpty) ...[
              SizedBox.square(
                dimension: markSize,
                child: AppNetworkImage(
                  url: mark,
                  displayWidth: null,
                  borderRadius: AppSpacing.radiusPill,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
            ],
            Flexible(child: Text(name, overflow: TextOverflow.ellipsis)),
          ],
        );
      },
    );
  }
}
