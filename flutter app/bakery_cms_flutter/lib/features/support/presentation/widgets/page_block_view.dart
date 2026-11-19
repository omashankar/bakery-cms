import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../domain/entities/page_block.dart';
import '../../domain/entities/page_block_type.dart';

/// One block of a CMS page, as the website's `renderBlocks` draws it: a
/// heading with room above it (none when it is the first block), or a
/// paragraph.
class PageBlockView extends StatelessWidget {
  const PageBlockView({super.key, required this.block, required this.isFirst});

  final PageBlock block;
  final bool isFirst;

  @override
  Widget build(BuildContext context) {
    return switch (block.type) {
      PageBlockType.heading => Padding(
        padding: EdgeInsets.only(top: isFirst ? 0 : AppSpacing.xl, bottom: AppSpacing.sm),
        child: Semantics(header: true, child: Text(block.content, style: context.text.titleLarge)),
      ),
      PageBlockType.paragraph => Padding(
        padding: EdgeInsets.only(top: isFirst ? 0 : AppSpacing.md),
        child: Text(block.content, style: context.text.bodyMedium),
      ),
    };
  }
}
