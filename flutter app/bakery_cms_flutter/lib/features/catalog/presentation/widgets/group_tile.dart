import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_network_image.dart';
import '../../domain/entities/product_group.dart';

/// A round picture with the group's name under it.
class GroupTile extends StatelessWidget {
  const GroupTile({super.key, required this.group, this.size = AppSpacing.categoryTileSize});

  final ProductGroup group;
  final double size;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      onTap: () => context.push(AppRoutes.group(group.kind.path, group.slug)),
      child: SizedBox(
        width: size + AppSpacing.lg,
        child: Column(
          children: [
            SizedBox.square(
              dimension: size,
              child: AppNetworkImage(url: group.image, borderRadius: AppSpacing.radiusPill),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              group.name,
              maxLines: 2,
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
              style: context.text.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}
