import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/cart_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../../../core/widgets/app_network_image.dart';
import '../../../../core/widgets/app_snackbar.dart';
import '../../../../core/widgets/quantity_stepper.dart';
import '../../../delivery_area/presentation/widgets/earliest_delivery_text.dart';
import '../../../store/presentation/widgets/shop_currency.dart';
import '../../../wishlist/presentation/bloc/wishlist_cubit.dart';
import '../../domain/entities/cart_item.dart';
import '../bloc/cart_cubit.dart';

/// One line of the cart, laid out as the website's cart line: a picture
/// large enough to recognise, the name with the price level with it on the
/// right, the choices under the name, the quantity, and the actions along
/// the bottom as quiet links.
class CartLineTile extends StatelessWidget {
  const CartLineTile({super.key, required this.item});

  final CartItem item;

  static const double imageSize = 96;
  static const double photoSize = 40;

  /// At once, with the way back: removing was the one irreversible action,
  /// so it says what went and offers Undo, as the website's cart does.
  void _remove(BuildContext context) {
    final cart = context.read<CartCubit>();
    final removed = item;
    cart.remove(removed.id);
    AppSnackbar.success(
      context,
      CartStrings.removed(removed.name),
      actionLabel: CartStrings.undo,
      onAction: () => cart.add(removed, announce: false),
    );
  }

  /// Saved to the wishlist (unless it is there already) and out of the cart.
  void _moveToWishlist(BuildContext context) {
    final wishlist = context.read<WishlistCubit>();
    final alreadySaved = wishlist.state.slugs.contains(item.productSlug);
    if (!alreadySaved) wishlist.toggle(item.productSlug);
    context.read<CartCubit>().remove(item.id);
    AppSnackbar.success(
      context,
      alreadySaved ? CartStrings.alreadyInWishlist : CartStrings.movedToWishlist,
    );
  }

  void _open(BuildContext context) => context.push(AppRoutes.product(item.productSlug));

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final muted = context.text.bodySmall?.copyWith(color: colors.onSurfaceVariant);
    final photo = item.photoUrl;
    final deliveryDate = item.deliveryDate;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(color: colors.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.md, AppSpacing.md, AppSpacing.xs),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                InkWell(
                  onTap: () => _open(context),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                  child: SizedBox.square(
                    dimension: imageSize,
                    child: AppNetworkImage(url: item.image),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                InkWell(
                                  onTap: () => _open(context),
                                  child: Text(
                                    item.name,
                                    style: context.text.bodyMedium,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                // The reference's "Estimated Delivery: Today",
                                // per line.
                                EarliestDeliveryText(style: muted),
                              ],
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          _LinePrice(item: item),
                        ],
                      ),
                      for (final choice in item.choiceSummary) _Choice(text: choice),
                      if (item.message != null)
                        Text(
                          '${CartStrings.messagePrefix} "${item.message}"',
                          style: muted,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      if (deliveryDate != null && deliveryDate.trim().isNotEmpty)
                        Text(CartStrings.deliveryOn(deliveryDate, item.deliveryTime), style: muted),
                      if (photo != null)
                        Padding(
                          padding: const EdgeInsets.only(top: AppSpacing.xs),
                          child: Row(
                            children: [
                              SizedBox.square(
                                dimension: photoSize,
                                child: AppNetworkImage(url: photo),
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Expanded(child: Text(CartStrings.photoToPrint, style: muted)),
                            ],
                          ),
                        ),
                      const SizedBox(height: AppSpacing.sm),
                      QuantityStepper(
                        quantity: item.quantity,
                        onChanged: (quantity) =>
                            context.read<CartCubit>().updateQuantity(item.id, quantity),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            Divider(height: AppSpacing.sm, color: colors.outlineVariant),
            Wrap(
              alignment: WrapAlignment.end,
              children: [
                _LineAction(
                  icon: Icons.favorite_border,
                  label: CartStrings.moveToWishlist,
                  onPressed: () => _moveToWishlist(context),
                ),
                _LineAction(
                  icon: Icons.delete_outline,
                  label: CartStrings.remove,
                  onPressed: () => _remove(context),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// The line's total, the shop's compare-at struck through with what it
/// takes off, and the price of one when there are several.
class _LinePrice extends StatelessWidget {
  const _LinePrice({required this.item});

  final CartItem item;

  @override
  Widget build(BuildContext context) {
    final currency = context.shopCurrency;
    final colors = context.colors;
    final small = context.text.bodySmall?.copyWith(color: colors.onSurfaceVariant);
    final was = item.compareAtPrice;
    final discounted = was != null && was > item.unitPrice;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(
          MoneyFormatter.format(item.lineTotal, currency: currency),
          style: context.text.titleSmall,
        ),
        if (discounted) ...[
          Text(
            MoneyFormatter.format(was * item.quantity, currency: currency),
            style: small?.copyWith(decoration: TextDecoration.lineThrough),
          ),
          Text(
            CartStrings.percentOff(((was - item.unitPrice) / was * 100).round()),
            style: small?.copyWith(color: colors.tertiary, fontWeight: FontWeight.w600),
          ),
        ],
        if (item.quantity > 1)
          Text(CartStrings.each(MoneyFormatter.format(item.unitPrice, currency: currency)), style: small),
      ],
    );
  }
}

/// One of the line's choices: "Size: 1 kg" as a label and its answer, or a
/// bare fact the shop set, which reads as one thing.
class _Choice extends StatelessWidget {
  const _Choice({required this.text});

  final String text;

  static const String _separator = ': ';

  @override
  Widget build(BuildContext context) {
    final muted = context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant);
    final at = text.indexOf(_separator);
    if (at == -1) return Text(text, style: muted);
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: '${text.substring(0, at)}$_separator', style: muted),
          TextSpan(
            text: text.substring(at + _separator.length),
            style: context.text.bodySmall?.copyWith(fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

/// A quiet link along the line's foot.
class _LineAction extends StatelessWidget {
  const _LineAction({required this.icon, required this.label, required this.onPressed});

  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return TextButton.icon(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        foregroundColor: context.colors.onSurfaceVariant,
        textStyle: context.text.labelMedium,
      ),
      icon: Icon(icon, size: AppSpacing.iconSm),
      label: Text(label),
    );
  }
}
