import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/catalog_strings.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../../store/presentation/widgets/shop_currency.dart';
import '../../domain/entities/product_selection.dart';
import '../../domain/entities/product_weight.dart';
import '../../domain/entities/variant_option.dart';
import '../bloc/product_detail/product_detail_cubit.dart';
import 'option_section.dart';

/// Every choice the product offers: the size and the shop's own variant
/// groups, as far as the shop's modules allow (the website's product page:
/// no size picker with Weight off, no Shape group with Shape off). The
/// legacy flat flavour and shape lists are not offered, as on the website.
/// Sections are spaced evenly, with no margin above the first.
class ProductOptions extends StatelessWidget {
  const ProductOptions({super.key, required this.selection});

  final ProductSelection selection;

  @override
  Widget build(BuildContext context) {
    final product = selection.product;
    final cubit = context.read<ProductDetailCubit>();
    final currency = context.shopCurrency;

    final sections = <Widget>[
      if (selection.offersWeights)
        OptionSection<ProductWeight>(
          title: product.weightLabel ?? CatalogStrings.defaultWeightLabel,
          options: product.weights,
          selected: selection.weight,
          labelOf: (w) => w.label,
          onSelected: cubit.selectWeight,
          isRequired: true,
        ),
      for (final group in selection.visibleGroups)
        OptionSection<VariantOption>(
          title: group.name,
          options: group.options,
          selected: group.optionById(selection.variantSelections[group.id]),
          labelOf: (option) => option.priceAdjustment == 0
              ? option.label
              : '${option.label} (+${MoneyFormatter.format(option.priceAdjustment, currency: currency)})',
          onSelected: (option) => cubit.selectVariant(group.id, option.id),
          isRequired: group.required,
        ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (index, section) in sections.indexed) ...[
          if (index > 0) const SizedBox(height: AppSpacing.lg),
          section,
        ],
      ],
    );
  }
}
