import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/catalog_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/quantity_stepper.dart';
import '../bloc/product_detail/product_detail_cubit.dart';

/// "Quantity  − 1 +" on the page. It lives here, not in the bottom bar, so
/// the bar keeps room for the heart and two full buttons on a narrow phone.
class ProductQuantityRow extends StatelessWidget {
  const ProductQuantityRow({super.key, required this.quantity});

  final int quantity;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Text(CatalogStrings.quantity, style: context.text.titleSmall)),
        const SizedBox(width: AppSpacing.sm),
        QuantityStepper(
          quantity: quantity,
          onChanged: context.read<ProductDetailCubit>().setQuantity,
        ),
      ],
    );
  }
}
