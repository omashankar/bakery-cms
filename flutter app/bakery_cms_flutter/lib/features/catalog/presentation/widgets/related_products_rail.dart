import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../domain/entities/product.dart';
import 'product_card.dart';
import 'product_rail_view.dart';

/// "You may also like": a horizontal row of the shop's own cards, sized as the
/// home page's rails are, so a card looks the same in both places.
class RelatedProductsRail extends StatelessWidget {
  const RelatedProductsRail({super.key, required this.products});

  final List<Product> products;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height:
          ProductRailView.cardWidth +
          MediaQuery.textScalerOf(context).scale(ProductCard.textBlockHeight),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        itemCount: products.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
        itemBuilder: (_, index) => SizedBox(
          width: ProductRailView.cardWidth,
          child: ProductCard(product: products[index]),
        ),
      ),
    );
  }
}
