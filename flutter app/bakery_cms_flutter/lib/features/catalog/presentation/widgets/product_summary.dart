import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/catalog_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../domain/entities/product_selection.dart';
import 'product_price_line.dart';
import 'product_rating_row.dart';
import 'stock_badge.dart';

/// Name, rating (only when there are reviews) and the price of what is
/// chosen now. The name is plain, never bold, as on the website.
class ProductSummary extends StatelessWidget {
  const ProductSummary({super.key, required this.selection});

  final ProductSelection selection;

  @override
  Widget build(BuildContext context) {
    final product = selection.product;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(product.name, style: context.text.titleLarge?.copyWith(fontWeight: FontWeight.w400)),
        if (product.reviewCount > 0) ...[
          const SizedBox(height: AppSpacing.sm),
          ProductRatingRow(rating: product.rating, count: product.reviewCount),
        ],
        const SizedBox(height: AppSpacing.md),
        ProductPriceLine(amount: selection.unitPrice, compareAt: selection.compareAt),
        if (!product.isAvailable) ...[
          const SizedBox(height: AppSpacing.sm),
          const StockBadge(label: CatalogStrings.outOfStock),
        ],
      ],
    );
  }
}
