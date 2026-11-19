import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/widgets/app_network_image.dart';
import '../../domain/entities/product_group.dart';

/// A group's picture in a rounded box of [imageAspect], with its name under
/// it. A tap opens the group's listing.
class GroupPictureTile extends StatelessWidget {
  const GroupPictureTile({
    super.key,
    required this.group,
    required this.imageAspect,
    required this.nameLines,
    required this.nameStyle,
  });

  final ProductGroup group;
  final double imageAspect;
  final int nameLines;
  final TextStyle? nameStyle;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      onTap: () => context.push(AppRoutes.group(group.kind.path, group.slug)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AspectRatio(
            aspectRatio: imageAspect,
            child: AppNetworkImage(url: group.image, borderRadius: AppSpacing.radiusMd),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            group.name,
            maxLines: nameLines,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: nameStyle,
          ),
        ],
      ),
    );
  }
}
