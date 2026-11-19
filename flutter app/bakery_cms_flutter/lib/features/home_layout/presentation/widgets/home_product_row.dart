import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../catalog/domain/entities/product.dart';
import '../../../catalog/presentation/widgets/product_card.dart';
import '../../../catalog/presentation/widgets/product_rail_view.dart';

/// A sideways-scrolling row of product cards: the same cards and width as
/// the app's other rows.
class HomeProductRow extends StatelessWidget {
  const HomeProductRow({super.key, required this.products});

  final List<Product> products;

  @override
  Widget build(BuildContext context) {
    const width = ProductRailView.cardWidth;
    return SizedBox(
      height: width + MediaQuery.textScalerOf(context).scale(ProductCard.textBlockHeight),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        itemCount: products.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
        itemBuilder: (_, index) => SizedBox(
          width: width,
          child: ProductCard(product: products[index]),
        ),
      ),
    );
  }
}
