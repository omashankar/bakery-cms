import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/wishlist_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../wishlist/presentation/bloc/wishlist_cubit.dart';
import '../../../wishlist/presentation/bloc/wishlist_state.dart';

/// The square, outlined heart at the start of the product page's bottom bar:
/// the same save as the heart on the photo, through the app-wide
/// [WishlistCubit], so the two always agree.
class WishlistSquareButton extends StatelessWidget {
  const WishlistSquareButton({super.key, required this.productSlug});

  final String productSlug;

  @override
  Widget build(BuildContext context) {
    return BlocSelector<WishlistCubit, WishlistState, bool>(
      selector: (state) => state.contains(productSlug),
      builder: (context, saved) => SizedBox.square(
        dimension: AppSpacing.buttonHeight,
        child: IconButton.outlined(
          tooltip: saved ? WishlistStrings.remove : WishlistStrings.add,
          onPressed: () => context.read<WishlistCubit>().toggle(productSlug),
          style: IconButton.styleFrom(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSpacing.radiusMd)),
            side: BorderSide(color: context.colors.outline),
          ),
          icon: Icon(
            saved ? Icons.favorite : Icons.favorite_border,
            color: saved ? context.colors.error : context.colors.onSurfaceVariant,
          ),
        ),
      ),
    );
  }
}
