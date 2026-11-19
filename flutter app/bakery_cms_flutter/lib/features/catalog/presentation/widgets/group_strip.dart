import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/widgets/section_header.dart';
import '../../domain/entities/product_group.dart';
import 'group_tile.dart';

/// A titled horizontal row of categories or occasions.
class GroupStrip extends StatelessWidget {
  const GroupStrip({super.key, required this.title, required this.groups, this.onViewAll});

  static const double height = AppSpacing.categoryTileSize + AppSpacing.xxxl;

  final String title;
  final List<ProductGroup> groups;
  final VoidCallback? onViewAll;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHeader(title: title, onViewAll: onViewAll),
        SizedBox(
          height: height,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
            itemCount: groups.length,
            separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
            itemBuilder: (_, index) => GroupTile(group: groups[index]),
          ),
        ),
      ],
    );
  }
}
