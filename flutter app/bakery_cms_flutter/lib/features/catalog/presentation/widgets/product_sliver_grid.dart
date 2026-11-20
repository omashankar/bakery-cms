import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../domain/entities/product.dart';
import 'product_card.dart';

/// Products as a responsive grid, for use inside a `CustomScrollView`.
///
/// A row is exactly as tall as a card: the square image (as wide as the
/// column) plus [ProductCard.textBlockHeight] at the reader's text size. A
/// fixed aspect ratio either left a band of empty space under every row or,
/// with large text, cut the price off.
class ProductSliverGrid extends StatelessWidget {
  const ProductSliverGrid({super.key, required this.products});

  final List<Product> products;

  static const double _spacing = AppSpacing.md;

  @override
  Widget build(BuildContext context) {
    final textHeight = MediaQuery.textScalerOf(context).scale(ProductCard.textBlockHeight);
    return SliverPadding(
      padding: const EdgeInsets.all(AppSpacing.lg),
      sliver: SliverLayoutBuilder(
        builder: (context, constraints) {
          final width = constraints.crossAxisExtent;
          final columns = (width / AppSpacing.productGridMaxExtent).ceil().clamp(2, 6);
          final columnWidth = (width - _spacing * (columns - 1)) / columns;
          return SliverGrid.builder(
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: columns,
              crossAxisSpacing: _spacing,
              mainAxisSpacing: AppSpacing.lg,
              mainAxisExtent: columnWidth + textHeight,
            ),
            itemCount: products.length,
            itemBuilder: (_, index) => ProductCard(product: products[index]),
          );
        },
      ),
    );
  }
}
