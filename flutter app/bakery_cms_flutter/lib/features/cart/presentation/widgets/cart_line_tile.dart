import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/cart_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_dialog.dart';
import '../../../../core/widgets/app_network_image.dart';
import '../../../../core/widgets/quantity_stepper.dart';
import '../../../store/presentation/widgets/shop_price.dart';
import '../../domain/entities/cart_item.dart';
import '../bloc/cart_cubit.dart';

class CartLineTile extends StatelessWidget {
  const CartLineTile({super.key, required this.item});

  final CartItem item;

  Future<void> _confirmRemove(BuildContext context) async {
    final cart = context.read<CartCubit>();
    final confirmed = await AppDialog.confirm(
      context,
      title: CartStrings.removeTitle,
      message: CartStrings.removeMessage,
      confirmLabel: CartStrings.remove,
      destructive: true,
    );
    if (confirmed) await cart.remove(item.id);
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.read<CartCubit>();
    final choices = item.choiceSummary.join(' · ');
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => context.push(AppRoutes.product(item.productSlug)),
            child: SizedBox.square(
              dimension: AppSpacing.thumbnailSize + AppSpacing.lg,
              child: AppNetworkImage(url: item.image),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name,
                  style: context.text.bodyLarge,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (choices.isNotEmpty)
                  Text(
                    choices,
                    style: context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
                  ),
                if (item.message != null)
                  Text(
                    '${CartStrings.messagePrefix} ${item.message}',
                    style: context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                if (item.deliveryDate != null && item.deliveryDate!.trim().isNotEmpty)
                  Text(
                    CartStrings.deliveryOn(item.deliveryDate!, item.deliveryTime),
                    style: context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
                  ),
                if (item.photoUrl != null)
                  Row(
                    children: [
                      Icon(
                        Icons.photo_outlined,
                        size: AppSpacing.iconSm,
                        color: context.colors.primary,
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        CartStrings.photoAdded,
                        style: context.text.bodySmall?.copyWith(color: context.colors.primary),
                      ),
                    ],
                  ),
                const SizedBox(height: AppSpacing.xs),
                ShopPrice(amount: item.lineTotal, style: context.text.titleSmall),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    QuantityStepper(
                      quantity: item.quantity,
                      onChanged: (quantity) => cart.updateQuantity(item.id, quantity),
                    ),
                    const Spacer(),
                    IconButton(
                      tooltip: CartStrings.remove,
                      icon: Icon(Icons.delete_outline, color: context.colors.error),
                      onPressed: () => _confirmRemove(context),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
