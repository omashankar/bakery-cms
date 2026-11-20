import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/wishlist_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../bloc/wishlist_cubit.dart';
import '../bloc/wishlist_state.dart';

/// A heart in a small round chip that saves [productSlug] to the wishlist, or
/// forgets it. Made to sit over a product photo.
///
/// [size] is the chip's diameter; the tap target is never smaller than
/// Material's 48dp, whatever the chip's size. Reads the app-wide
/// [WishlistCubit].
class WishlistHeartButton extends StatelessWidget {
  const WishlistHeartButton({super.key, required this.productSlug, this.size = AppSpacing.xxl});

  final String productSlug;
  final double size;

  /// The heart's share of the chip.
  static const double _iconFraction = 0.6;

  @override
  Widget build(BuildContext context) {
    final target = math.max(size, kMinInteractiveDimension);
    return BlocSelector<WishlistCubit, WishlistState, bool>(
      selector: (state) => state.contains(productSlug),
      builder: (context, saved) => Semantics(
        container: true,
        button: true,
        label: saved ? WishlistStrings.remove : WishlistStrings.add,
        child: InkResponse(
          onTap: () => context.read<WishlistCubit>().toggle(productSlug),
          radius: target / 2,
          child: SizedBox.square(
            dimension: target,
            child: Center(
              child: DecoratedBox(
                decoration: ShapeDecoration(
                  color: context.colors.surface,
                  shape: CircleBorder(
                    side: BorderSide(
                      color: context.colors.outlineVariant,
                      width: AppSpacing.borderWidth,
                    ),
                  ),
                ),
                child: SizedBox.square(
                  dimension: size,
                  child: Icon(
                    saved ? Icons.favorite : Icons.favorite_border,
                    size: size * _iconFraction,
                    color: saved ? context.colors.error : context.colors.onSurfaceVariant,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
