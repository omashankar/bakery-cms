import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../domain/entities/product.dart';

/// The description and the shop's own titled blocks, first one open. The
/// page gives it its heading and spacing.
///
/// [hasContent] says whether there is anything to draw, so the page can leave
/// the whole section out.
class ProductDescription extends StatelessWidget {
  const ProductDescription({super.key, required this.product});

  final Product product;

  static bool hasContent(Product product) =>
      product.description.trim().isNotEmpty || product.descriptionBlocks.isNotEmpty;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (product.description.trim().isNotEmpty) ...[
          Text(product.description.trim(), style: context.text.bodyMedium),
          // The first block draws a divider; keep it off the last line.
          if (product.descriptionBlocks.isNotEmpty) const SizedBox(height: AppSpacing.md),
        ],
        for (final (index, block) in product.descriptionBlocks.indexed)
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            childrenPadding: const EdgeInsets.only(bottom: AppSpacing.md),
            expandedCrossAxisAlignment: CrossAxisAlignment.start,
            initiallyExpanded: index == 0,
            title: Text(block.heading, style: context.text.titleSmall),
            children: [Text(block.body, style: context.text.bodyMedium)],
          ),
      ],
    );
  }
}
