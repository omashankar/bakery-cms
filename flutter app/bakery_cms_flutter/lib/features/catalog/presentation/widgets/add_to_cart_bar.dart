import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/catalog_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../cart/presentation/bloc/cart_cubit.dart';
import '../../domain/entities/product_selection.dart';
import 'product_bar_button.dart';
import 'wishlist_square_button.dart';

/// The wishlist heart, Add to cart and Buy now, pinned to the bottom of the
/// product. The quantity is chosen on the page above (`ProductQuantityRow`):
/// four controls do not fit a 360dp phone.
///
/// Add to cart announces the line (the page shows "added to cart"); Buy now
/// adds it quietly and goes straight to the cart.
class AddToCartBar extends StatelessWidget {
  const AddToCartBar({super.key, required this.selection, this.photoPending = false});

  final ProductSelection selection;

  /// A picked photo is still uploading, or failed (see `CakePhotoState`).
  final bool photoPending;

  @override
  Widget build(BuildContext context) {
    final enabled = selection.canAddToCart && !photoPending;
    final cart = context.read<CartCubit>();

    return DecoratedBox(
      decoration: BoxDecoration(
        color: context.colors.surface,
        border: Border(top: BorderSide(color: context.colors.outline)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            children: [
              WishlistSquareButton(productSlug: selection.product.slug),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: ProductBarButton(
                  label: CatalogStrings.addToCart,
                  onPressed: enabled ? () => cart.add(selection.toCartItem()) : null,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: ProductBarButton.secondary(
                  label: CatalogStrings.buyNow,
                  onPressed: enabled
                      ? () async {
                          await cart.add(selection.toCartItem(), announce: false);
                          if (context.mounted) context.go(AppRoutes.cart);
                        }
                      : null,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
